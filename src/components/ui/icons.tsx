import type { SVGProps } from "react";

/**
 * A small, consistent icon set (1.5px strokes, 24px grid). Drawn in-house so
 * the storefront ships no icon library. Decorative by default (aria-hidden);
 * pass `title` for a meaningful standalone icon.
 */

type IconProps = SVGProps<SVGSVGElement> & { title?: string; size?: number };

function Icon({ title, size = 20, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Icon>
);
export const BagIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5.5 8h13l-1 12h-11z" />
    <path d="M9 10V7a3 3 0 0 1 6 0v3" />
  </Icon>
);
export const HeartIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p} fill={filled ? "currentColor" : "none"}>
    <path d="M12 19.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10Z" />
  </Icon>
);
export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5" />
  </Icon>
);
export const MenuIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </Icon>
);
export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
);
export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);
export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
);
export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m15 6-6 6 6 6" />
  </Icon>
);
export const ArrowUpIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Icon>
);
export const ArrowDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Icon>
);
export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const MinusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
  </Icon>
);
export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);
export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 7h15M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4.5h6V7" />
  </Icon>
);
export const EditIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="m13.5 6.5 4 4" />
  </Icon>
);
export const CopyIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="1.5" />
    <path d="M15.5 8.5V5.5A1 1 0 0 0 14.5 4.5h-9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3" />
  </Icon>
);
export const ShareIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 15V4M8 8l4-4 4 4" />
    <path d="M6 12v7.5h12V12" />
  </Icon>
);
export const ZoomIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2M11 8.5v5M8.5 11h5" />
  </Icon>
);
export const StarIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p} fill={filled ? "currentColor" : "none"}>
    <path d="m12 4 2.4 4.9 5.3.8-3.8 3.8.9 5.3L12 16.3l-4.8 2.5.9-5.3-3.8-3.8 5.3-.8z" />
  </Icon>
);
export const TruckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 6.5h10v9h-10zM13.5 9.5h4l3 3v3h-7" />
    <circle cx="7" cy="17.5" r="1.7" />
    <circle cx="17" cy="17.5" r="1.7" />
  </Icon>
);
export const StoreIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 10v9.5h16V10M3.5 10 5 4.5h14l1.5 5.5c0 1.3-1 2.3-2.3 2.3s-2.3-1-2.3-2.3c0 1.3-1 2.3-2.3 2.3h-.2c-1.3 0-2.3-1-2.3-2.3 0 1.3-1 2.3-2.3 2.3S3.5 11.3 3.5 10Z" />
    <path d="M10 19.5v-4h4v4" />
  </Icon>
);
export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);
export const SparkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5c.6 4 2.4 6 6.5 6.5-4.1.6-5.9 2.5-6.5 6.5-.6-4-2.4-5.9-6.5-6.5 4.1-.5 5.9-2.5 6.5-6.5ZM18.5 15.5c.3 1.6 1 2.4 2.5 2.6-1.5.3-2.2 1-2.5 2.6-.3-1.6-1-2.3-2.5-2.6 1.5-.2 2.2-1 2.5-2.6Z" />
  </Icon>
);
export const PenIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14.5 5.5 18.5 9.5 9 19H5v-4z" />
    <path d="M4.5 21h15" />
  </Icon>
);
export const MailIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
    <path d="m4 7 8 6 8-6" />
  </Icon>
);
export const PhoneIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L16 13l4 1.5v3c0 1.1-.9 2-2 2C10.3 19.5 4.5 13.7 4.5 6c0-1.1.9-2 2-2Z" />
  </Icon>
);
export const WhatsAppIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 19.5 5.7 16A8 8 0 1 1 8.4 18.5z" />
    <path d="M9.3 8.6c.2-.5.6-.6.9-.6h.5c.2 0 .4.1.5.4l.7 1.6c.1.2 0 .5-.1.7l-.5.6c.6 1.1 1.4 2 2.6 2.6l.6-.5c.2-.2.5-.2.7-.1l1.6.7c.3.1.4.3.4.5v.5c0 .4-.2.8-.6.9-1.6.6-6.5-1.6-7.3-6.4Z" />
  </Icon>
);
export const InstagramIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="4" width="16" height="16" rx="4.5" />
    <circle cx="12" cy="12" r="3.6" />
    <circle cx="16.9" cy="7.1" r=".6" fill="currentColor" />
  </Icon>
);
export const FacebookIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13.5 20.5v-7h2.4l.4-2.8h-2.8V9c0-.8.3-1.4 1.4-1.4h1.5V5.1c-.3 0-1.2-.1-2.2-.1-2.2 0-3.6 1.3-3.6 3.7v2H8.2v2.8h2.4v7" />
  </Icon>
);
export const TikTokIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 4v10.5a3.5 3.5 0 1 1-3-3.5" />
    <path d="M14 4c.4 2.4 2 4 4.5 4.3" />
  </Icon>
);
export const LinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Icon>
);
export const UploadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 15V4.5M7.5 9 12 4.5 16.5 9" />
    <path d="M4.5 15v4.5h15V15" />
  </Icon>
);
export const ImageIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="m20.5 16-5-5-8 8.5" />
  </Icon>
);
export const AlertIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4 21 19.5H3z" />
    <path d="M12 10v4M12 17v.01" />
  </Icon>
);
export const InfoIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8v.01" />
  </Icon>
);
export const GridIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" />
  </Icon>
);
export const BoxIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 3.5 8 4v9l-8 4-8-4v-9z" />
    <path d="m4 7.5 8 4 8-4M12 11.5v9" />
  </Icon>
);
export const TagIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 4h7.5l8.5 8.5-7.5 7.5L4 11.5z" />
    <circle cx="8.5" cy="8.5" r="1.3" />
  </Icon>
);
export const UsersIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8.5" r="3" />
    <path d="M3.5 19c.6-3 2.8-4.7 5.5-4.7s4.9 1.7 5.5 4.7" />
    <path d="M15.5 5.7a3 3 0 0 1 0 5.6M17.5 14.6c1.6.6 2.7 2.1 3 4.4" />
  </Icon>
);
export const CardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
    <path d="M3.5 9.5h17M7 15h3" />
  </Icon>
);
export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="2.8" />
    <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" />
  </Icon>
);
export const LayoutIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
    <path d="M3.5 9.5h17M9.5 9.5v10" />
  </Icon>
);
export const FileIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 3.5h8l4 4v13H6z" />
    <path d="M14 3.5v4h4M9 12.5h6M9 16h6" />
  </Icon>
);
export const ChatIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 5.5h15v10h-9l-4 3.5v-3.5h-2z" />
  </Icon>
);
export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5 19 6v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6z" />
  </Icon>
);
export const ChartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20V4M4 20h16" />
    <path d="M8 16v-4M12 16V8M16 16v-6" />
  </Icon>
);
export const LogoutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 4.5H6v15h8M10.5 12H20M16.5 8.5 20 12l-3.5 3.5" />
  </Icon>
);
export const ExternalIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 4.5h5.5V10M19.5 4.5 11 13M18 14v5.5H4.5V6H10" />
  </Icon>
);
export const DragIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="6" r=".9" fill="currentColor" />
    <circle cx="15" cy="6" r=".9" fill="currentColor" />
    <circle cx="9" cy="12" r=".9" fill="currentColor" />
    <circle cx="15" cy="12" r=".9" fill="currentColor" />
    <circle cx="9" cy="18" r=".9" fill="currentColor" />
    <circle cx="15" cy="18" r=".9" fill="currentColor" />
  </Icon>
);
export const FlameIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21c3.3 0 6-2.4 6-5.8 0-3.6-3-5.6-3.8-9.7-1.6 1.4-2.2 3-2.2 4.6-1-.6-1.8-2-1.8-3.6C7.6 8.6 6 11.6 6 15.2 6 18.6 8.7 21 12 21Z" />
  </Icon>
);
