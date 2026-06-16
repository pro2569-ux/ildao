import Link from 'next/link';
import { ReactNode } from 'react';

/** 공용 빈 상태 컴포넌트 (아이콘은 prop으로 주입) */
export function EmptyState({
  icon,
  message,
  subMessage,
  linkHref,
  linkText,
}: {
  icon?: ReactNode;
  message: string;
  subMessage?: string;
  linkHref?: string;
  linkText?: string;
}) {
  return (
    <div className="text-center py-16">
      {icon && <div className="mb-4 flex justify-center text-gray-200">{icon}</div>}
      <p className="text-gray-500 text-sm font-medium">{message}</p>
      {subMessage && <p className="text-gray-400 text-xs mt-1">{subMessage}</p>}
      {linkHref && linkText && (
        <Link
          href={linkHref}
          className="inline-block mt-4 py-2.5 px-5 bg-primary-500 text-white text-sm font-medium rounded-lg"
        >
          {linkText}
        </Link>
      )}
    </div>
  );
}
