-- Souvenir Galore: the business contact details supplied by the owner.
-- Shown in the footer, on the contact page and as the WhatsApp, Instagram and
-- email buttons. Editable afterwards in the dashboard (Settings -> Contact & social).
-- If contact settings were already saved, any field the owner already filled
-- in is kept; only empty fields take these values.

INSERT INTO "Setting" ("key", "value", "updatedAt")
VALUES (
  'contact',
  '{"email": "souvenirgalore@outlook.com", "phone": "+961 76 620 434", "whatsapp": "96176620434", "instagram": "souvenir.galore"}'::jsonb,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO UPDATE SET
  "value" = EXCLUDED."value" || (
    SELECT COALESCE(jsonb_object_agg(field.key, field.value), '{}'::jsonb)
    FROM jsonb_each("Setting"."value") AS field
    WHERE field.value NOT IN ('""'::jsonb, 'null'::jsonb)
  ),
  "updatedAt" = CURRENT_TIMESTAMP;
