{/* EN-TÊTE : Affiche l'année au-dessus du jour */}
{displayTimeSlots.map((dateStr) => {
  const [year, month, day] = dateStr.split("-").map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))

  return (
    <TableHeaderCell
      key={dateStr}
      className="border-none text-center font-medium text-gray-700 whitespace-nowrap dark:text-gray-300"
    >
      <span className="block text-[10px] font-semibold text-gray-400 dark:text-gray-500">
        {year}
      </span>
      <span className="block text-xs capitalize">
        {d.toLocaleDateString("fr-FR", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          timeZone: "UTC",
        })}
      </span>
    </TableHeaderCell>
  )
})}
