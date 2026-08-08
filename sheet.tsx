function DroppableContainer({
  id,
  title,
  items,
}: {
  id: string
  title: string
  items: string[]
}) {
  // 1. On récupère setNodeRef et isOver de dnd-kit
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div className="flex max-h-[500px] flex-col justify-between overflow-auto rounded-xl border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-900/50">
      <div className="flex items-center justify-between border-b border-gray-200/80 pb-2 dark:border-gray-800">
        <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
          {title}
        </span>
        <span className="rounded-full bg-gray-200/60 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          {items.length}
        </span>
      </div>

      {/* 2. Le ref est posé sur la zone dropping avec un style visuel quand c'est survolé */}
      <div
        ref={setNodeRef}
        className={`mt-2.5 flex min-h-[120px] flex-1 flex-col space-y-1.5 rounded-lg border border-dashed p-2 transition-colors ${
          isOver
            ? "border-[#048890] bg-[#048890]/5"
            : "border-gray-200 dark:border-gray-800"
        }`}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableItem key={item} id={item} />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
