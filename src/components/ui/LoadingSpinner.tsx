/** 로딩 스피너 컴포넌트 */
export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }[size];

  return (
    <div className="flex items-center justify-center p-4">
      <div
        className={`${sizeClass} border-4 border-gray-200 border-t-primary-500 rounded-full animate-spin`}
      />
    </div>
  );
}
