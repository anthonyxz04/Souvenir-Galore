import { WhatsAppIcon } from "@/components/ui/icons";

/** Small floating shortcut to chat on WhatsApp (only when the owner adds a number). */
export function WhatsAppBubble({ number }: { number: string }) {
  const text = encodeURIComponent("Hello! I have a question about your products.");
  return (
    <a
      href={`https://wa.me/${number}?text=${text}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 right-4 z-30 inline-flex h-13 items-center gap-2 rounded-full bg-olive pl-4 pr-5 text-sm font-medium text-white shadow-lift hover:bg-olive-deep"
    >
      <WhatsAppIcon size={22} />
      <span>Chat with us</span>
    </a>
  );
}
