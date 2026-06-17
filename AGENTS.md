# UI / Design System Rules

## Design direction

Build interfaces that feel modern, clean, premium, and professional. The target style is a modern B2B SaaS dashboard: calm, structured, data-focused, and presentation-ready.

Avoid generic AI-looking design:

* No random gradients
* No rainbow colors
* No excessive shadows
* No playful colors unless requested
* No cluttered dashboard layouts
* No cramped spacing
* No chart junk

## Layout and spacing

* Use a consistent 8px spacing system.
* Prioritize whitespace and clear visual hierarchy.
* Keep card padding, border radius, borders, and shadows consistent.
* Align labels, values, buttons, chart axes, and table columns precisely.
* Avoid dense dashboards unless the data requires it.

## Typography

* Use clear hierarchy:

  * Page title: 28–36px
  * Section title: 18–22px
  * Body text: 14–16px
  * Helper text: 12–13px
* Use limited font weights.
* Use tabular numerals for dashboard metrics where possible.
* Make key numbers easy to scan.

## Colors

* Use a restrained neutral palette.
* Use one primary accent color.
* Use semantic colors only when needed: success, warning, danger.
* Do not overuse bright colors.
* Make sure contrast is readable in both light and dark mode if supported.

## Charts

* Use line charts for trends over time.
* Use bar charts for comparisons or rankings.
* Use horizontal bar charts for many categories.
* Use pie or donut charts only for simple composition with max 5 categories.
* Avoid 3D charts.
* Avoid rainbow palettes.
* Every chart should have:

  * Clear title
  * Short insight or subtitle
  * Readable axis labels
  * Clean tooltip
  * Compact number formatting
  * Subtle gridlines
* Reduce visual noise.
* Highlight only the most important series or category.

## Tables

* Tables must be readable and scannable.
* Use clear column alignment.
* Use subtle dividers.
* Right-align numbers.
* Keep row height comfortable.
* Add empty/loading/error states where relevant.

## Responsive behavior

* UI must look good on desktop and mobile.
* Cards should stack cleanly on small screens.
* Charts and tables should remain readable.
* Avoid horizontal overflow unless necessary for large tables.

## Quality gate

Before finishing any UI-related task:

1. Review the result as a senior product designer.
2. Identify remaining issues in spacing, hierarchy, alignment, colors, typography, charts, and responsiveness.
3. Fix visual issues before final response.
4. Do not change business logic unless explicitly required.
