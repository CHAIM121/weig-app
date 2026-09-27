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
    <span className="brand" aria-label="WEIG" dir="ltr">
      <Image
        className="brand-lockup"
        src="/branding/weig-logo.png"
        alt=""
        width={1266}
        height={1014}
        priority
      />
    </span>
  );
}
