interface Props {
  isUsed: boolean
}

export default function StatusBadge({ isUsed }: Props) {
  return isUsed ? (
    <span
      className="inline-flex items-center gap-1 bg-success text-white text-xs font-medium px-2 py-0.5 rounded-full"
      aria-label="사용 중"
    >
      사용
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1 bg-danger text-white text-xs font-medium px-2 py-0.5 rounded-full"
      aria-label="미사용"
    >
      미사용
    </span>
  )
}
