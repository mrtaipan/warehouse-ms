# Warehouse Map Design QA

final result: passed

## Scope

- Route: `/dashboard/storage/warehouse-map`
- Feature: interactive Storage warehouse map for LV87, LV85, and LV83.
- Visual source: user-provided warehouse top-view references and rack front-view reference.

## Checks

- Desktop layout keeps the Storage sidebar, subnav, warehouse picker, map panel, and detail panel aligned with the existing dashboard system.
- LV87, LV85, and LV83 switch correctly, with LV83 exposing ARK-1 through ARK-7 labels and LV85 exposing the 7-21 rack lanes.
- Pallet click opens the selected-pallet inspector, and Enter Rack View shows a 3-level by 2-position front rack layout.
- Current Goods and History segmented controls render and switch without navigation.
- Empty states render as empty pallet positions when no storage data is present.
- Desktop body width remains within the viewport. Mobile check at 390px stacks the picker, map, and inspector without page-level horizontal overflow.
- Lint passes with `npm.cmd run lint`.
- Production build passes with `npm.cmd run build` after allowing network access for Next font downloads.

## Notes

- Browser screenshot capture timed out twice in the Browser API, so visual QA used DOM snapshots, interaction checks, console logs, and layout metrics.
- Existing unrelated warning remains from `/mob-text-logo.png` image aspect ratio styling in the dashboard sidebar.
