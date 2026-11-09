/**
 * L4 — DataTable Presentation & Token Styles (`@platform/ui`)
 *
 * Maps `density` (`compact | default | comfortable`), `variant` (`surface | subtle`),
 * and compound part states (`focused`, `editing`, `saving`, `error`, `selected`, `readonly`)
 * strictly to token-backed Tailwind v4 `@theme inline` classes defined in
 * `@platform/tokens/tokens.css`.
 *
 * RULE: Zero raw hex, rgb, or pixel values.
 */

export const DATATABLE_DENSITIES = [
	"compact",
	"default",
	"comfortable",
] as const;
export type DataTableDensity = (typeof DATATABLE_DENSITIES)[number];

export const DATATABLE_VARIANTS = ["surface", "subtle"] as const;
export type DataTableVariant = (typeof DATATABLE_VARIANTS)[number];

const ROOT_BASE_CLASSES = [
	"flex flex-col w-full overflow-hidden",
	"rounded-table border border-table-border font-sans text-fg-primary",
].join(" ");

const ROOT_VARIANT_CLASSES: Record<DataTableVariant, string> = {
	surface: "bg-table-bg",
	subtle: "bg-subtle",
};

const TOOLBAR_CLASSES = [
	"flex flex-wrap items-center justify-between",
	"border-b border-table-border bg-table-header-bg",
	"px-table-cell-px py-table-cell-py text-btn-md text-fg-primary",
].join(" ");

const SCROLL_VIEWPORT_CLASSES = "relative w-full overflow-auto bg-table-bg";

const TABLE_ELEMENT_CLASSES =
	"w-full border-collapse text-left font-sans text-btn-md text-fg-primary";

const HEADER_CLASSES =
	"sticky top-0 z-10 border-b border-table-border bg-table-header-bg text-table-header-fg";

const HEADER_ROW_CLASSES = "flex w-full items-center";

const HEADER_CELL_CLASSES = [
	"flex flex-1 items-center select-none",
	"h-table-row-h px-table-cell-px py-table-cell-py",
	"font-btn text-btn-sm text-table-header-fg",
	"data-[sortable=true]:cursor-pointer data-[sortable=true]:hover:text-fg-primary",
].join(" ");

const BODY_CLASSES = "relative block w-full divide-y divide-table-border";

const ROW_CLASSES = [
	"flex w-full items-center transition-colors",
	"h-table-row-h bg-table-row-bg hover:bg-table-row-hover",
	"data-[selected=true]:bg-table-row-selected",
	"data-[pending=true]:bg-table-saving-bg",
	"data-[clickable=true]:cursor-pointer",
].join(" ");

const CELL_CLASSES = [
	"relative flex flex-1 items-center truncate",
	"h-table-row-h px-table-cell-px py-table-cell-py text-btn-md text-fg-primary",
	"data-[focused=true]:outline data-[focused=true]:outline-border-focus",
	"data-[editing=true]:outline data-[editing=true]:outline-table-edit-ring data-[editing=true]:bg-surface",
	"data-[saving=true]:bg-table-saving-bg data-[saving=true]:text-fg-secondary",
	"data-[error=true]:bg-table-error-bg data-[error=true]:outline data-[error=true]:outline-table-error-ring",
	"data-[editable=false]:text-fg-secondary",
].join(" ");

const CELL_EDITOR_INPUT_CLASSES = [
	"w-full bg-surface text-fg-primary font-sans text-btn-md",
	"rounded-btn border border-border-focus px-btn-px-sm",
	"focus-visible:outline focus-visible:outline-border-focus",
].join(" ");

const CELL_ERROR_BADGE_CLASSES =
	"ml-btn-px-sm truncate text-btn-sm text-danger font-btn";

const PAGINATION_CLASSES = [
	"flex items-center justify-between",
	"border-t border-table-border bg-table-header-bg",
	"px-table-cell-px py-table-cell-py text-btn-sm text-fg-secondary",
].join(" ");

const STATUS_BANNER_CLASSES = [
	"flex items-center justify-center",
	"px-table-cell-px py-table-cell-py text-btn-md text-fg-secondary",
	"data-[status=error]:bg-table-error-bg data-[status=error]:text-danger",
].join(" ");

export interface DataTableStyleOptions {
	variant?: DataTableVariant | undefined;
	className?: string | undefined;
}

export function getDataTableRootClassName(
	options: DataTableStyleOptions = {},
): string {
	const variant = options.variant ?? "surface";
	return [ROOT_BASE_CLASSES, ROOT_VARIANT_CLASSES[variant], options.className]
		.filter(Boolean)
		.join(" ");
}

export function getDataTableToolbarClassName(className?: string): string {
	return [TOOLBAR_CLASSES, className].filter(Boolean).join(" ");
}

export function getDataTableViewportClassName(className?: string): string {
	return [SCROLL_VIEWPORT_CLASSES, className].filter(Boolean).join(" ");
}

export function getDataTableTableClassName(className?: string): string {
	return [TABLE_ELEMENT_CLASSES, className].filter(Boolean).join(" ");
}

export function getDataTableHeaderClassName(className?: string): string {
	return [HEADER_CLASSES, className].filter(Boolean).join(" ");
}

export function getDataTableHeaderRowClassName(className?: string): string {
	return [HEADER_ROW_CLASSES, className].filter(Boolean).join(" ");
}

export function getDataTableHeaderCellClassName(className?: string): string {
	return [HEADER_CELL_CLASSES, className].filter(Boolean).join(" ");
}

export function getDataTableBodyClassName(className?: string): string {
	return [BODY_CLASSES, className].filter(Boolean).join(" ");
}

export function getDataTableRowClassName(className?: string): string {
	return [ROW_CLASSES, className].filter(Boolean).join(" ");
}

export function getDataTableCellClassName(className?: string): string {
	return [CELL_CLASSES, className].filter(Boolean).join(" ");
}

export function getDataTableCellEditorInputClassName(
	className?: string,
): string {
	return [CELL_EDITOR_INPUT_CLASSES, className].filter(Boolean).join(" ");
}

export function getDataTableCellErrorClassName(className?: string): string {
	return [CELL_ERROR_BADGE_CLASSES, className].filter(Boolean).join(" ");
}

export function getDataTablePaginationClassName(className?: string): string {
	return [PAGINATION_CLASSES, className].filter(Boolean).join(" ");
}

export function getDataTableStatusBannerClassName(className?: string): string {
	return [STATUS_BANNER_CLASSES, className].filter(Boolean).join(" ");
}
