import Image from "next/image";

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-symbol ${className}`.trim()} aria-hidden="true">
      <Image src="/branding/weig-mark.png" alt="" width={875} height={475} priority />
    </span>
  );
}

export function Logo() {
  return (
    <span className="brand" aria-label="WEIG | וועג" dir="ltr">
      <LogoMark />
      <span className="brand-word">WEIG</span>
    </span>
  );
}
