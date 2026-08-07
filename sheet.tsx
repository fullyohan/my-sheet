// Tremor chartColors [v0.1.0] - Extensible avec Hexadécimal

export type ColorUtility = "bg" | "stroke" | "fill" | "text"

export const chartColors = {
  blue: {
    bg: "bg-blue-500",
    stroke: "stroke-blue-500",
    fill: "fill-blue-500",
    text: "text-blue-500",
  },
  emerald: {
    bg: "bg-emerald-500",
    stroke: "stroke-emerald-500",
    fill: "fill-emerald-500",
    text: "text-emerald-500",
  },
  violet: {
    bg: "bg-violet-500",
    stroke: "stroke-violet-500",
    fill: "fill-violet-500",
    text: "text-violet-500",
  },
  amber: {
    bg: "bg-amber-500",
    stroke: "stroke-amber-500",
    fill: "fill-amber-500",
    text: "text-amber-500",
  },
  gray: {
    bg: "bg-gray-500",
    stroke: "stroke-gray-500",
    fill: "fill-gray-500",
    text: "text-gray-500",
  },
  cyan: {
    bg: "bg-cyan-500",
    stroke: "stroke-cyan-500",
    fill: "fill-cyan-500",
    text: "text-cyan-500",
  },
  pink: {
    bg: "bg-pink-500",
    stroke: "stroke-pink-500",
    fill: "fill-pink-500",
    text: "text-pink-500",
  },
  lime: {
    bg: "bg-lime-500",
    stroke: "stroke-lime-500",
    fill: "fill-lime-500",
    text: "text-lime-500",
  },
  fuchsia: {
    bg: "bg-fuchsia-500",
    stroke: "stroke-fuchsia-500",
    fill: "fill-fuchsia-500",
    text: "text-fuchsia-500",
  },
} as const satisfies {
  [color: string]: {
    [key in ColorUtility]: string
  }
}

export type KnownChartColorKeys = keyof typeof chartColors

/**
 * Type acceptant les couleurs prédéfinies OU n'importe quel code Hexa (ex: "#048890")
 */
export type AvailableChartColorsKeys = KnownChartColorKeys | `#${string}`

export const AvailableChartColors: KnownChartColorKeys[] = Object.keys(
  chartColors,
) as Array<KnownChartColorKeys>

/**
 * Mappe les catégories vers des couleurs (clés prédéfinies ou Hexa)
 */
export const constructCategoryColors = (
  categories: string[],
  colors: AvailableChartColorsKeys[],
): Map<string, AvailableChartColorsKeys> => {
  const categoryColors = new Map<string, AvailableChartColorsKeys>()
  categories.forEach((category, index) => {
    categoryColors.set(category, colors[index % colors.length])
  })
  return categoryColors
}

/**
 * Helper de vérification si une chaîne est au format Hexa
 */
export const isHexColor = (color: string): boolean => {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)
}

/**
 * Retourne la classe Tailwind statique si c'est une couleur connue,
 * ou une classe Tailwind arbitraire (ex: `bg-[#048890]`) si c'est un Hexa.
 */
export const getColorClassName = (
  color: AvailableChartColorsKeys,
  type: ColorUtility,
): string => {
  const fallbackColor = {
    bg: "bg-gray-500",
    stroke: "stroke-gray-500",
    fill: "fill-gray-500",
    text: "text-gray-500",
  }

  // 1. Si c'est une couleur nommée dans chartColors
  if (color in chartColors) {
    return chartColors[color as KnownChartColorKeys]?.[type] ?? fallbackColor[type]
  }

  // 2. Si c'est un code Hexa, on utilise les classes arbitraires Tailwind CSS
  if (isHexColor(color)) {
    return `${type}-[${color}]`
  }

  return fallbackColor[type]
}

/**
 * Helper supplémentaire utiles pour passer directement dans l'attribut `style={{ ... }}` 
 * des composants SVG/HTML si besoin.
 */
export const getColorStyle = (
  color: AvailableChartColorsKeys,
  type: "backgroundColor" | "borderColor" | "color" | "stroke" | "fill",
): React.CSSProperties => {
  if (isHexColor(color)) {
    return { [type]: color }
  }
  return {}
}
