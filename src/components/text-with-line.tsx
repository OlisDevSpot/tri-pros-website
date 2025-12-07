export function TextWithLine({ text }: { text: string }) {
  return (
    <h2 className="flex uppercase min-w-fit items-center after:h-0.5 after:content-[''] after:grow after:bg-primary after:flex after:top-1/2 after:-translate-y-1/2 after:left-full after:ml-2">
      {text}
    </h2>
  )
}
