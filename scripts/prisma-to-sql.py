#!/usr/bin/env python3
"""
Generate PostgreSQL DDL from prisma/schema.prisma, following the conventions
`prisma migrate` uses (type mapping, defaults, index/constraint names,
foreign-key actions). Used to create the Netlify Database migration in
netlify/database/migrations/, which Netlify applies automatically on deploy.

    python3 scripts/prisma-to-sql.py prisma/schema.prisma > netlify/database/migrations/<ts>_init/migration.sql

Supports the features this schema uses: scalars, enums, scalar lists,
autoincrement, now(), cuid() (client-side), @unique, @@unique, @@id, @@index,
named and unnamed relations with onDelete. It stops with an error on anything
else (implicit many-to-many, @map, native types), so the output is never
silently wrong.
"""
import re
import sys

schema = re.sub(r"//[^\n]*", "", open(sys.argv[1]).read())

enums = {}
for m in re.finditer(r"enum (\w+) \{(.*?)\}", schema, re.S):
    enums[m.group(1)] = [v.strip() for v in m.group(2).split() if v.strip()]

models = {}
order = []
for m in re.finditer(r"model (\w+) \{(.*?)\n\}", schema, re.S):
    name = m.group(1)
    order.append(name)
    fields, block = [], []
    for raw in m.group(2).split("\n"):
        line = raw.strip()
        if not line:
            continue
        if line.startswith("@@"):
            block.append(line)
            continue
        fname, ftype, *rest = line.split(None, 2)
        fields.append({"name": fname, "type": ftype, "attrs": rest[0] if rest else ""})
    models[name] = {"fields": fields, "block": block}

for name, model in models.items():
    for line in model["block"]:
        if line.startswith("@@map") or line.startswith("@@schema"):
            sys.exit(f"unsupported: {name} {line}")
    for f in model["fields"]:
        if "@map(" in f["attrs"] or "@db." in f["attrs"]:
            sys.exit(f"unsupported attribute on {name}.{f['name']}")

SCALAR = {"String": "TEXT", "Int": "INTEGER", "BigInt": "BIGINT", "Float": "DOUBLE PRECISION", "Boolean": "BOOLEAN",
          "DateTime": "TIMESTAMP(3)", "Json": "JSONB", "Decimal": "DECIMAL(65,30)"}


def base_type(t):
    return t.rstrip("?").replace("[]", "")


def is_relation(f):
    return base_type(f["type"]) in models


def default_sql(f, pg_type):
    m = re.search(r"@default\((.*)\)", f["attrs"])
    if not m:
        return None
    # balance parentheses of the default expression
    expr, depth = "", 0
    for ch in m.group(1):
        if ch == "(":
            depth += 1
        elif ch == ")":
            if depth == 0:
                break
            depth -= 1
        expr += ch
    expr = expr.strip()
    if expr in ("cuid()", "uuid()", "autoincrement()"):
        return None
    if expr == "now()":
        return "CURRENT_TIMESTAMP"
    if expr in ("true", "false"):
        return expr
    if re.fullmatch(r"-?\d+(\.\d+)?", expr):
        return expr
    if expr.startswith('"'):
        return "'" + expr[1:-1].replace("'", "''") + "'"
    if expr == "[]":
        return f"ARRAY[]::{pg_type}"
    if base_type(f["type"]) in enums and expr in enums[base_type(f["type"])]:
        return f"'{expr}'"
    sys.exit(f"unsupported default {expr} on {f['name']}")


def relation_args(f):
    m = re.search(r"@relation\((.*?)\)(?!\s*\])", f["attrs"])
    if not m:
        return {}
    text = m.group(1)
    args = {}
    nm = re.match(r'\s*"([^"]+)"', text)
    if nm:
        args["name"] = nm.group(1)
    nm = re.search(r'name:\s*"([^"]+)"', text)
    if nm:
        args["name"] = nm.group(1)
    for key in ("fields", "references"):
        km = re.search(key + r":\s*\[([^\]]*)\]", text)
        if km:
            args[key] = [x.strip() for x in km.group(1).split(",")]
    om = re.search(r"onDelete:\s*(\w+)", text)
    if om:
        args["onDelete"] = om.group(1)
    om = re.search(r"onUpdate:\s*(\w+)", text)
    if om:
        args["onUpdate"] = om.group(1)
    return args


ACTIONS = {"Cascade": "CASCADE", "SetNull": "SET NULL", "Restrict": "RESTRICT", "NoAction": "NO ACTION", "SetDefault": "SET DEFAULT"}

out_enums, out_tables, out_indexes, out_fks = [], [], [], []

for e, vals in enums.items():
    out_enums.append(f"-- CreateEnum\nCREATE TYPE \"{e}\" AS ENUM (" + ", ".join(f"'{v}'" for v in vals) + ");")

for name in order:
    model = models[name]
    cols, pk = [], None
    for f in model["fields"]:
        if is_relation(f):
            continue
        b = base_type(f["type"])
        is_list = f["type"].endswith("[]")
        optional = f["type"].endswith("?")
        if b in SCALAR:
            pg = SCALAR[b]
        elif b in enums:
            pg = f'"{b}"'
        else:
            sys.exit(f"unknown type {b}")
        if "autoincrement()" in f["attrs"]:
            pg = {"INTEGER": "SERIAL", "BIGINT": "BIGSERIAL"}[pg]
        col_type = pg + ("[]" if is_list else "")
        parts = [f'"{f["name"]}"', col_type]
        if not optional and not is_list:
            parts.append("NOT NULL")
        d = default_sql(f, col_type)
        if d is not None:
            parts.append(f"DEFAULT {d}")
        cols.append("    " + " ".join(parts))
        if re.search(r"(^|\s)@id\b", f["attrs"]):
            pk = [f["name"]]
        if re.search(r"(^|\s)@unique\b", f["attrs"]):
            out_indexes.append(f'-- CreateIndex\nCREATE UNIQUE INDEX "{name}_{f["name"]}_key" ON "{name}"("{f["name"]}");')
    for line in model["block"]:
        cm = re.search(r"\[([^\]]*)\]", line)
        columns = [c.strip() for c in cm.group(1).split(",")] if cm else []
        col_list = ", ".join(f'"{c}"' for c in columns)
        if line.startswith("@@id"):
            pk = columns
        elif line.startswith("@@unique"):
            out_indexes.append(f'-- CreateIndex\nCREATE UNIQUE INDEX "{name}_{"_".join(columns)}_key" ON "{name}"({col_list});')
        elif line.startswith("@@index"):
            out_indexes.append(f'-- CreateIndex\nCREATE INDEX "{name}_{"_".join(columns)}_idx" ON "{name}"({col_list});')
        else:
            sys.exit(f"unsupported block attribute {line}")
    if not pk:
        sys.exit(f"{name} has no primary key")
    cols.append(f'    CONSTRAINT "{name}_pkey" PRIMARY KEY (' + ", ".join(f'"{c}"' for c in pk) + ")")
    out_tables.append(f'-- CreateTable\nCREATE TABLE "{name}" (\n' + ",\n".join(cols) + "\n);")

    for f in model["fields"]:
        if not is_relation(f):
            continue
        args = relation_args(f)
        if "fields" not in args:
            # back-relation side: make sure the other side holds the foreign key (no implicit m2m)
            other = models[base_type(f["type"])]
            back = [g for g in other["fields"] if base_type(g["type"]) == name and "fields" in relation_args(g)
                    and relation_args(g).get("name") == args.get("name")]
            if not back:
                sys.exit(f"implicit many-to-many or unresolved relation: {name}.{f['name']}")
            continue
        target = base_type(f["type"])
        optional = f["type"].endswith("?")
        on_delete = ACTIONS[args.get("onDelete", "SetNull" if optional else "Restrict")]
        on_update = ACTIONS[args.get("onUpdate", "Cascade")]
        fk_cols = ", ".join(f'"{c}"' for c in args["fields"])
        ref_cols = ", ".join(f'"{c}"' for c in args["references"])
        out_fks.append(
            f'-- AddForeignKey\nALTER TABLE "{name}" ADD CONSTRAINT "{name}_{"_".join(args["fields"])}_fkey" FOREIGN KEY ({fk_cols}) '
            f'REFERENCES "{target}"({ref_cols}) ON DELETE {on_delete} ON UPDATE {on_update};'
        )

print("-- Souvenir Galore: initial schema, generated from prisma/schema.prisma by scripts/prisma-to-sql.py\n")
print("\n\n".join(out_enums + out_tables + out_indexes + out_fks))
