'use client'

import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/browser'
import { getProfileByAuthenticatedUser } from '@/utils/user-profiles'

const supabase = createClient()
const PRODUCT_PHOTOS_BUCKET = 'product-photos'
const PL_RETURN_SOURCE_PHASE = 'Packing List'
const PL_RETURN_SOURCE_PHASES = [PL_RETURN_SOURCE_PHASE, 'packing_list']
const SIZE_CHART_FIELDS = ['weight_value', 'length_value', 'width_value', 'width_afterpull', 'sleeve_length', 'thigh_width']

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  panel: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '22px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
  },
  headerMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  editorActionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'nowrap',
    justifyContent: 'flex-end',
  },
  segmentedToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px',
    borderRadius: '999px',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    width: 'max-content',
  },
  segmentedButton: {
    minHeight: '30px',
    padding: '0 12px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: '999px',
    background: 'transparent',
    color: '#64748b',
    fontSize: '12px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  segmentedButtonActive: {
    background: '#fff',
    color: '#0f172a',
    borderColor: '#cbd5e1',
    boxShadow: '0 6px 14px rgba(15, 23, 42, 0.08)',
  },
  toolIconButton: {
    width: '40px',
    height: '40px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '10px',
    background: '#fff',
    color: '#0f172a',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '17px',
    fontWeight: 900,
  },
  toolIconButtonPrimary: {
    background: '#0f766e',
    borderColor: '#99f6e4',
    color: '#fff',
    boxShadow: '0 8px 18px rgba(15, 118, 110, 0.16)',
  },
  toolIconButtonActive: {
    background: '#0f172a',
    borderColor: '#0f172a',
    color: '#fff',
  },
  eyebrow: {
    margin: 0,
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#64748b',
  },
  titleLine: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '12px',
    flexWrap: 'wrap',
  },
  title: {
    margin: '4px 0 0',
    fontSize: '28px',
    lineHeight: 1.05,
    fontWeight: 900,
    color: '#0f172a',
  },
  grnChip: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '42px',
    padding: '0 16px',
    borderRadius: '14px',
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    color: '#0f172a',
    fontSize: '24px',
    fontWeight: 950,
    letterSpacing: '-0.03em',
    fontVariantNumeric: 'tabular-nums',
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#475569',
    fontSize: '13px',
    lineHeight: 1.45,
  },
  iconButton: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    border: '1px solid #fecaca',
    background: '#fff',
    color: '#dc2626',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: 900,
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '12px',
  },
  metricPillGrid: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  compactMetricPillGrid: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  metricPill: {
    minHeight: '40px',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    background: '#f8fafc',
    padding: '6px 10px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '2px',
  },
  metricPillLabel: {
    color: '#64748b',
    fontSize: '9px',
    fontWeight: 900,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  metricPillValue: {
    color: '#0f172a',
    fontSize: '16px',
    lineHeight: 1,
    fontWeight: 950,
    fontVariantNumeric: 'tabular-nums',
  },
  metricCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  metricLabel: {
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 850,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#0f172a',
    fontSize: '24px',
    fontWeight: 950,
    fontVariantNumeric: 'tabular-nums',
  },
  section: {
    borderTop: '1px solid #e5e7eb',
    paddingTop: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '12px',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    margin: 0,
    color: '#111827',
    fontSize: '20px',
    fontWeight: 900,
  },
  sectionSubtitle: {
    margin: '4px 0 0',
    color: '#64748b',
    fontSize: '13px',
  },
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    alignItems: 'end',
  },
  multipageTableShell: {
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: '18px',
    overflow: 'hidden',
    background: '#fff',
  },
  multipageTabs: {
    display: 'flex',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: '4px',
    minHeight: '46px',
    padding: '4px 8px 0 4px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#e2e8f0',
    background: '#fff',
  },
  multipageTabButton: {
    minHeight: '40px',
    marginBottom: '-1px',
    padding: '0 14px',
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: '2px',
    borderLeftWidth: 0,
    borderStyle: 'solid',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRadius: 0,
    background: 'transparent',
    color: '#475569',
    fontSize: '13px',
    fontWeight: 900,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'color 140ms ease, border-color 140ms ease',
  },
  filterField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: '0 1 160px',
  },
  filterLabel: {
    color: '#64748b',
    fontSize: '10px',
    fontWeight: 900,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  filterSelect: {
    width: '100%',
    height: '38px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '10px',
    background: '#fff',
    color: '#0f172a',
    padding: '0 10px',
    fontSize: '13px',
    fontWeight: 700,
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))',
    gap: '10px',
  },
  productCard: {
    position: 'relative',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: '14px',
    background: '#fff',
    padding: '4px',
    aspectRatio: '1 / 1',
    display: 'block',
    cursor: 'pointer',
    overflow: 'visible',
    transition: 'box-shadow 160ms ease, border-color 160ms ease',
  },
  productCardActive: {
    borderColor: '#0f766e',
    boxShadow: '0 0 0 3px rgba(15, 118, 110, 0.12)',
  },
  productCardPreview: {
    zIndex: 10,
    boxShadow: '0 12px 24px rgba(15, 23, 42, 0.14)',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '10px',
    background: '#f1f5f9',
    transition: 'transform 160ms ease',
  },
  noPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: '10px',
    background: '#f1f5f9',
    color: '#94a3b8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 900,
  },
  cardPopover: {
    position: 'absolute',
    left: '50%',
    bottom: 'calc(100% + 10px)',
    transform: 'translateX(-50%)',
    zIndex: 8,
    width: '220px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: '14px',
    background: '#fff',
    padding: '10px',
    boxShadow: '0 18px 36px rgba(15, 23, 42, 0.18)',
    pointerEvents: 'none',
  },
  cardPopoverBelow: {
    top: 'calc(100% + 10px)',
    bottom: 'auto',
  },
  cardPopoverEyebrow: {
    display: 'block',
    color: '#64748b',
    fontSize: '10px',
    fontWeight: 900,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  cardTitle: {
    display: 'block',
    marginTop: '3px',
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: 900,
    lineHeight: 1.25,
  },
  cardMeta: {
    display: 'block',
    marginTop: '4px',
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 750,
    lineHeight: 1.35,
  },
  statusPill: {
    alignSelf: 'flex-start',
    minHeight: '24px',
    padding: '4px 9px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 900,
  },
  statusEmpty: {
    background: '#f1f5f9',
    color: '#64748b',
  },
  statusProgress: {
    background: '#fff7ed',
    color: '#c2410c',
  },
  statusComplete: {
    background: '#ecfdf5',
    color: '#047857',
  },
  editorGrid: {
    display: 'grid',
    gridTemplateColumns: '320px minmax(0, 1fr)',
    gap: '18px',
    alignItems: 'start',
  },
  featureCard: {
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    background: '#f8fafc',
  },
  featureMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  sourceInline: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '24px',
    padding: '0 8px',
    borderRadius: '999px',
    background: '#e0f2fe',
    color: '#075985',
    fontSize: '11px',
    fontWeight: 900,
    width: 'max-content',
  },
  modelLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  modelNameStrong: {
    color: '#0f172a',
    fontSize: '16px',
    lineHeight: 1.25,
    fontWeight: 950,
  },
  qtyCheckerRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(120px, 0.8fr) minmax(0, 1fr)',
    gap: '10px',
    alignItems: 'end',
  },
  qtyTotalBox: {
    minWidth: '72px',
    minHeight: '40px',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#0f172a',
    padding: '0 12px',
    fontSize: '22px',
    lineHeight: 1,
    fontWeight: 950,
    fontVariantNumeric: 'tabular-nums',
  },
  editorQtyGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  editorQtyBox: {
    minWidth: '96px',
    minHeight: '42px',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    background: '#fff',
    padding: '6px 10px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '2px',
  },
  editorQtyLabel: {
    color: '#64748b',
    fontSize: '9px',
    fontWeight: 900,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  editorQtyValue: {
    color: '#0f172a',
    fontSize: '16px',
    lineHeight: 1,
    fontWeight: 950,
    fontVariantNumeric: 'tabular-nums',
  },
  featureImage: {
    width: '100%',
    height: '240px',
    objectFit: 'cover',
    borderRadius: '12px',
    background: '#f1f5f9',
  },
  featureNoPhoto: {
    width: '100%',
    height: '240px',
    borderRadius: '12px',
    background: '#f1f5f9',
    color: '#94a3b8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 900,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
  },
  label: {
    color: '#334155',
    fontSize: '12px',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  input: {
    width: '100%',
    height: '40px',
    boxSizing: 'border-box',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '0 10px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '14px',
  },
  textarea: {
    width: '100%',
    minHeight: '82px',
    boxSizing: 'border-box',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '10px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '14px',
    resize: 'vertical',
  },
  readonlyBox: {
    minHeight: '40px',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    background: '#f8fafc',
    padding: '9px 10px',
    color: '#0f172a',
    fontSize: '14px',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
  },
  plRow: {
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    background: '#fff',
  },
  plRowHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  plIdBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '28px',
    padding: '0 10px',
    borderRadius: '999px',
    background: '#e0f2fe',
    color: '#075985',
    fontSize: '13px',
    fontWeight: 950,
  },
  rowGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '10px',
  },
  sizeRow: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    background: '#fff',
  },
  sizeMainGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(120px, 1fr) minmax(120px, 1fr) 88px',
    gap: '8px',
    alignItems: 'end',
  },
  sizeHeaderGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(110px, 1fr) minmax(100px, 0.8fr) minmax(190px, 1.25fr) 88px',
    gap: '8px',
    alignItems: 'center',
  },
  sizeHeaderCell: {
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  sizeInputRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(110px, 1fr) minmax(100px, 0.8fr) minmax(190px, 1.25fr) 88px',
    gap: '8px',
    alignItems: 'center',
  },
  checkerPicker: {
    position: 'relative',
  },
  checkerPickerButton: {
    width: '100%',
    minHeight: '40px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '10px',
    background: '#fff',
    padding: '0 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    cursor: 'pointer',
  },
  checkerSummaryText: {
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  checkerPlusText: {
    color: '#0f766e',
    fontSize: '14px',
    fontWeight: 950,
    flexShrink: 0,
  },
  checkerMenu: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    zIndex: 20,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: '12px',
    background: '#fff',
    boxShadow: '0 16px 32px rgba(15, 23, 42, 0.14)',
    padding: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxHeight: '220px',
    overflowY: 'auto',
  },
  checkerOption: {
    minHeight: '34px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: '9px',
    background: '#fff',
    color: '#0f172a',
    padding: '0 8px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    textAlign: 'left',
  },
  checkerOptionActive: {
    background: '#ecfeff',
    borderColor: '#67e8f9',
    color: '#155e75',
  },
  checkerRadio: {
    width: '14px',
    height: '14px',
    borderRadius: '999px',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    flexShrink: 0,
  },
  checkerRadioActive: {
    borderColor: '#0f766e',
    boxShadow: 'inset 0 0 0 3px #fff',
    background: '#0f766e',
  },
  measurementPanel: {
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    background: '#f8fafc',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflowX: 'auto',
  },
  sizeChartShortcut: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1fr) auto',
    gap: '8px',
    alignItems: 'end',
    minWidth: '520px',
  },
  measurementHeaderGrid: {
    display: 'grid',
    gridTemplateColumns: '90px 70px repeat(6, minmax(120px, 1fr))',
    gap: '8px',
    alignItems: 'center',
    minWidth: '920px',
  },
  measurementInputGrid: {
    display: 'grid',
    gridTemplateColumns: '90px 70px repeat(6, minmax(120px, 1fr))',
    gap: '8px',
    alignItems: 'center',
    minWidth: '920px',
  },
  buttonRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  primaryButton: {
    minHeight: '40px',
    padding: '0 14px',
    border: 'none',
    borderRadius: '10px',
    background: '#0f766e',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  saveButton: {
    minWidth: '96px',
    flexShrink: 0,
    textAlign: 'center',
  },
  modeButtonActive: {
    background: '#0f172a',
    color: '#fff',
    borderColor: '#0f172a',
  },
  tableWrap: {
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    overflowX: 'auto',
    background: '#fff',
  },
  embeddedTableWrap: {
    overflowX: 'auto',
    background: '#fff',
  },
  embeddedEmpty: {
    margin: 0,
    padding: '24px 18px',
    background: '#fff',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '760px',
  },
  th: {
    padding: '12px',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    color: '#475569',
    fontSize: '11px',
    fontWeight: 900,
    textTransform: 'uppercase',
    textAlign: 'center',
    verticalAlign: 'middle',
  },
  td: {
    padding: '12px',
    borderTop: '1px solid #f1f5f9',
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: 800,
    textAlign: 'center',
    verticalAlign: 'middle',
  },
  tablePhoto: {
    width: '54px',
    height: '54px',
    borderRadius: '12px',
    objectFit: 'cover',
    background: '#f1f5f9',
    cursor: 'pointer',
  },
  tableNoPhoto: {
    width: '54px',
    height: '54px',
    borderRadius: '12px',
    background: '#f1f5f9',
    color: '#94a3b8',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '9px',
    fontWeight: 900,
  },
  sizeSummary: {
    display: 'flex',
    justifyContent: 'center',
    gap: '5px',
    flexWrap: 'wrap',
  },
  koliTitleCell: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    flexWrap: 'wrap',
  },
  koliName: {
    fontSize: '13px',
    fontWeight: 900,
    color: '#0f172a',
  },
  koliSelectCell: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  koliCheckbox: {
    width: '18px',
    height: '18px',
    accentColor: '#0f766e',
    cursor: 'pointer',
  },
  koliModePill: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '20px',
    padding: '0 8px',
    borderRadius: '999px',
    background: '#ecfeff',
    color: '#0e7490',
    fontSize: '10px',
    fontWeight: 900,
  },
  koliCellStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    alignItems: 'center',
  },
  koliItemText: {
    color: '#0f172a',
    fontSize: '12px',
    fontWeight: 700,
    lineHeight: 1.25,
    textAlign: 'left',
    width: '100%',
  },
  koliFlatValue: {
    color: '#0f172a',
    fontSize: '12px',
    fontWeight: 700,
    lineHeight: 1.25,
    fontVariantNumeric: 'tabular-nums',
  },
  koliDividerCell: {
    borderTop: '2px solid #94a3b8',
  },
  itemDividerCell: {
    borderTop: '1px dashed #cbd5e1',
  },
  koliQtyPill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '22px',
    minWidth: '42px',
    padding: '2px 8px',
    borderRadius: '999px',
    background: '#f0fdf4',
    color: '#047857',
    fontSize: '11px',
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
  },
  tableActionCell: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  previewOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.72)',
    zIndex: 60,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '18px',
  },
  previewFrame: {
    position: 'relative',
    display: 'inline-flex',
    maxWidth: 'min(92vw, 900px)',
    maxHeight: '86vh',
  },
  previewImage: {
    display: 'block',
    width: 'auto',
    height: 'auto',
    maxWidth: 'min(92vw, 900px)',
    maxHeight: '86vh',
    objectFit: 'contain',
  },
  previewClose: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    width: '34px',
    height: '34px',
    borderRadius: '999px',
    border: '1px solid #fecaca',
    background: 'rgba(255, 255, 255, 0.94)',
    color: '#dc2626',
    fontSize: '18px',
    fontWeight: 950,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.18)',
  },
  sizeChip: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '22px',
    padding: '2px 7px',
    borderRadius: '999px',
    background: '#eef2ff',
    color: '#3730a3',
    fontSize: '11px',
    fontWeight: 900,
  },
  secondaryButton: {
    minHeight: '40px',
    padding: '0 14px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '10px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  compactActionButton: {
    minHeight: '34px',
    padding: '0 12px',
    fontSize: '12px',
    whiteSpace: 'nowrap',
  },
  compactResetButton: {
    width: '38px',
    minHeight: '38px',
    padding: 0,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '999px',
    background: '#fff',
    color: '#475569',
    fontSize: '16px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  dangerButton: {
    minHeight: '40px',
    padding: '0 14px',
    border: '1px solid #fecaca',
    borderRadius: '10px',
    background: '#fff',
    color: '#dc2626',
    fontSize: '13px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  disabledButton: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  emptyText: {
    margin: 0,
    color: '#64748b',
    fontSize: '14px',
  },
  errorText: {
    margin: 0,
    color: '#dc2626',
    fontSize: '13px',
    fontWeight: 800,
  },
  successText: {
    margin: 0,
    color: '#047857',
    fontSize: '13px',
    fontWeight: 800,
  },
  saveFeedback: {
    minHeight: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
  },
  saveFeedbackText: {
    margin: 0,
    fontSize: '12px',
    fontWeight: 900,
    lineHeight: 1.35,
    textAlign: 'right',
  },
  editorFieldset: {
    border: 'none',
    padding: 0,
    margin: 0,
    minWidth: 0,
  },
  lockedArea: {
    opacity: 0.7,
    pointerEvents: 'none',
  },
  thumb: {
    width: '80px',
    height: '80px',
    objectFit: 'cover',
    borderRadius: '10px',
  },
  photoDetailHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  photoAddButton: {
    minHeight: '32px',
    padding: '0 10px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '9px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '12px',
    fontWeight: 900,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  photoThumbWrap: {
    position: 'relative',
    width: '62px',
    height: '62px',
  },
  photoThumbButton: {
    width: '62px',
    height: '62px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: '12px',
    padding: 0,
    background: '#fff',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  photoThumbButtonActive: {
    borderColor: '#0f766e',
    boxShadow: '0 0 0 3px rgba(15, 118, 110, 0.14)',
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  photoRemoveButton: {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    width: '22px',
    height: '22px',
    borderRadius: '999px',
    border: '1px solid #fecaca',
    background: '#fff',
    color: '#dc2626',
    fontSize: '12px',
    fontWeight: 950,
    lineHeight: 1,
    cursor: 'pointer',
  },
  mainPhotoBadge: {
    position: 'absolute',
    left: '4px',
    bottom: '4px',
    minHeight: '17px',
    padding: '0 5px',
    borderRadius: '999px',
    background: 'rgba(15, 118, 110, 0.92)',
    color: '#fff',
    fontSize: '8px',
    fontWeight: 950,
    display: 'inline-flex',
    alignItems: 'center',
  },
  setMainPhotoButton: {
    position: 'absolute',
    left: '4px',
    bottom: '4px',
    minHeight: '17px',
    padding: '0 5px',
    border: 'none',
    borderRadius: '999px',
    background: 'rgba(15, 23, 42, 0.82)',
    color: '#fff',
    fontSize: '8px',
    fontWeight: 950,
    cursor: 'pointer',
  },
  hiddenFileInput: {
    display: 'none',
  },
  allocationModal: {
    position: 'relative',
    width: 'min(920px, 94vw)',
    maxHeight: '86vh',
    overflow: 'hidden',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: '18px',
    background: '#fff',
    boxShadow: '0 24px 64px rgba(15, 23, 42, 0.28)',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    position: 'sticky',
    top: 0,
    zIndex: 5,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '18px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#e2e8f0',
    background: '#fff',
  },
  modalTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  modalTitle: {
    margin: '4px 0 0',
    color: '#0f172a',
    fontSize: '24px',
    lineHeight: 1.1,
    fontWeight: 950,
  },
  allocationPresetRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
  },
  allocationPresetButton: {
    minHeight: '28px',
    padding: '0 10px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#94a3b8',
    borderRadius: '999px',
    background: '#fff',
    color: '#334155',
    fontSize: '9px',
    fontWeight: 900,
    cursor: 'pointer',
    letterSpacing: '0.03em',
    boxShadow: '0 4px 10px rgba(15, 23, 42, 0.06)',
    whiteSpace: 'nowrap',
  },
  allocationPresetButtonHover: {
    borderColor: '#0f766e',
    color: '#0f766e',
    background: '#f0fdfa',
  },
  allocationPresetButtonActive: {
    borderColor: '#0f766e',
    color: '#fff',
    background: '#0f766e',
    boxShadow: '0 8px 16px rgba(15, 118, 110, 0.18)',
  },
  allocationModalBody: {
    overflow: 'auto',
    padding: '14px 18px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  allocationTableWrap: {
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: '14px',
    maxHeight: '46vh',
    overflow: 'auto',
    background: '#fff',
  },
  allocationTable: {
    width: '100%',
    minWidth: '860px',
    borderCollapse: 'collapse',
  },
  allocationStickyTh: {
    position: 'sticky',
    top: 0,
    zIndex: 3,
  },
  allocationTd: {
    padding: '10px',
    borderTop: '1px solid #f1f5f9',
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: 500,
    textAlign: 'center',
    verticalAlign: 'middle',
  },
  allocationPhotoButton: {
    width: '44px',
    height: '44px',
    border: 'none',
    borderRadius: '10px',
    padding: 0,
    background: 'transparent',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  allocationPhoto: {
    width: '44px',
    height: '44px',
    objectFit: 'cover',
    display: 'block',
  },
  allocationNoPhoto: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    background: '#f1f5f9',
    color: '#94a3b8',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '8px',
    fontWeight: 900,
  },
  allocationInput: {
    width: '84px',
    height: '36px',
    boxSizing: 'border-box',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '10px',
    background: '#fff',
    color: '#0f172a',
    padding: '0 8px',
    fontSize: '13px',
    fontWeight: 500,
    textAlign: 'center',
    fontVariantNumeric: 'tabular-nums',
  },
  allocationFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  modalFeedback: {
    minHeight: '22px',
    display: 'flex',
    alignItems: 'center',
  },
  modalActionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  printModal: {
    position: 'relative',
    width: 'min(520px, 94vw)',
    maxHeight: '84vh',
    overflow: 'hidden',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: '18px',
    background: '#fff',
    boxShadow: '0 24px 64px rgba(15, 23, 42, 0.28)',
    display: 'flex',
    flexDirection: 'column',
  },
  printModalBody: {
    padding: '16px 18px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  printChoiceGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  printChoiceButton: {
    minHeight: '48px',
    padding: '10px 12px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#cbd5e1',
    borderRadius: '12px',
    background: '#fff',
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  printChoiceButtonActive: {
    borderColor: '#0f766e',
    background: '#f0fdfa',
    color: '#0f766e',
  },
}

function normalize(value) {
  return String(value || '').trim().toUpperCase()
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function getModelKey(modelName, catalogName) {
  return `${normalize(modelName)}::${normalize(catalogName)}`
}

function getCatalogName(row = {}) {
  return row.catalogName || row.variant_name || row.variant_label || row.variant_code || row.model_color || ''
}

function getVariantCode(row = {}) {
  return row.sku_code || row.sku || row.source_variant_code || row.variant_code || row.variant_label || ''
}

function normalizePhotoUrls(value, fallback = '') {
  let photos = []
  if (Array.isArray(value)) {
    photos = value
  } else if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      photos = JSON.parse(value)
    } catch {
      photos = []
    }
  } else if (value) {
    photos = [value]
  }

  if (fallback) {
    photos = [fallback, ...photos]
  }

  return Array.from(new Set(photos.map((item) => String(item || '').trim()).filter(Boolean)))
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load image for compression.'))
    image.src = url
  })
}

async function compressImageFile(file) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('Please choose an image file.')
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImageFromUrl(objectUrl)
    const maxSize = 1280
    const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Image compression is not available in this browser.')
    }

    context.drawImage(image, 0, 0, width, height)

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.78)
    })

    if (!blob) {
      throw new Error('Failed to compress image.')
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'pl-detail-photo'
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function getSafeStorageSegment(value, fallback = 'item') {
  return (
    String(value || fallback)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback
  )
}

function getProductPhotoStoragePath(photoUrl) {
  const marker = `/storage/v1/object/public/${PRODUCT_PHOTOS_BUCKET}/`
  const index = String(photoUrl || '').indexOf(marker)
  if (index < 0) return ''
  return decodeURIComponent(String(photoUrl).slice(index + marker.length).split('?')[0] || '')
}

function getModelLabel(row = {}) {
  const catalogName = getCatalogName(row)
  return catalogName ? `${row.model_name || '-'} / ${catalogName}` : row.model_name || '-'
}

function getOverviewModelVariantLabel(row = {}) {
  const modelName = String(row.model_name || '').trim()
  const catalogName = String(getCatalogName(row) || '').trim()
  if (!modelName || !catalogName) return ''
  return `${modelName} / ${catalogName}`
}

function getCategoryPath(category = {}, categoryById = new Map()) {
  if (!category) return []

  const path = []
  const visited = new Set()
  let current = category

  while (current?.id && !visited.has(Number(current.id))) {
    visited.add(Number(current.id))
    path.unshift(String(current.category_name || current.name || '').trim())
    current = categoryById.get(Number(current.parent_id || 0))
  }

  const cleanPath = path.filter(Boolean)
  if (cleanPath.length > 1) return cleanPath

  const fullName = String(category.full_name || '').trim()
  if (fullName.includes('>')) {
    return fullName.split('>').map((item) => item.trim()).filter(Boolean)
  }

  return cleanPath.length ? cleanPath : fullName ? [fullName] : []
}

function getCategoryPathLabel(card = {}) {
  return (card.category_path || []).filter(Boolean).join(' > ')
}

function getUniqueOptions(items = []) {
  return [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

function matchesModelFilter(card = {}, filters = {}, excludeKey = '') {
  if (excludeKey !== 'brand' && filters.brand && (card.brand_name || 'UNBRANDED') !== filters.brand) return false
  if (excludeKey !== 'categoryPath' && filters.categoryPath && getCategoryPathLabel(card) !== filters.categoryPath) return false
  if (excludeKey !== 'model' && filters.model && getModelLabel(card) !== filters.model) return false
  return true
}

function createEmptySizeRow(index = 0) {
  return {
    id: `size-${Date.now()}-${index}`,
    breakdown_row_id: null,
    size_label: '',
    qty: '',
    mob_target_qty: null,
    oi_target_qty: null,
    allocation_source: 'DEFAULT_RULE',
    allocation_reason: '',
    checker_names: [],
    weight_value: '',
    length_value: '',
    width_value: '',
    width_afterpull: '',
    sleeve_length: '',
    thigh_width: '',
  }
}

function createEmptyReturnRow(index = 0) {
  return {
    id: `return-${Date.now()}-${index}`,
    warehouse_return_id: null,
    size_label: 'RETURN',
    qty: '',
    return_reason: '',
  }
}

function createPlRow(card, sequence = null, order = 1) {
  return {
    id: `pl-${Date.now()}-${order}`,
    pl_detail_seq: sequence,
    detail_order: order,
    pl_name: String(getModelLabel(card) || 'PL Item').toUpperCase(),
    pl_notes: '',
    pl_photo_url: '',
    pl_photo_urls: [],
    sizeRows: [createEmptySizeRow()],
    returnRows: [],
  }
}

function getLetterFromIndex(index) {
  const normalizedIndex = Number(index || 0)
  if (normalizedIndex <= 0) return 'A'

  let value = normalizedIndex
  let label = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    label = String.fromCharCode(65 + remainder) + label
    value = Math.floor((value - 1) / 26)
  }
  return label
}

function computePlLabel(card, plRow, rowCount) {
  const base = String(card.model_seq || '')
  const letter = Number(card.model_item_count || 0) > 1 ? card.pl_letter || 'A' : ''
  const hasSplit = rowCount > 1
  const subIndex = Number(plRow.detail_order || plRow.display_order || 0) || Number(plRow.pl_detail_seq || 0) || 1

  if (!hasSplit) return `${base}${letter}`
  return letter ? `${base}${letter}${subIndex}` : `${base}.${subIndex}`
}

function getPlModelIdentity(card = {}) {
  return card.product_model_id ? `model:${card.product_model_id}` : `legacy:${normalize(card.model_name)}`
}

function assignPlIdentities(cards = []) {
  const sequenceCards = cards
    .slice()
    .sort(
      (a, b) =>
        Number(b.receiving_qty || 0) - Number(a.receiving_qty || 0) ||
        a.firstSort - b.firstSort ||
        getModelLabel(a).localeCompare(getModelLabel(b))
    )
  const modelSequenceMap = new Map()
  const itemSequenceByModel = new Map()
  const plIdentityMap = new Map()

  sequenceCards.forEach((card) => {
    const modelIdentity = getPlModelIdentity(card)
    if (!modelSequenceMap.has(modelIdentity)) {
      modelSequenceMap.set(modelIdentity, modelSequenceMap.size + 1)
    }

    const nextItemSequence = (itemSequenceByModel.get(modelIdentity) || 0) + 1
    itemSequenceByModel.set(modelIdentity, nextItemSequence)
    plIdentityMap.set(card.key, {
      model_seq: modelSequenceMap.get(modelIdentity),
      pl_letter: getLetterFromIndex(nextItemSequence),
      model_item_count: 0,
    })
  })

  sequenceCards.forEach((card) => {
    const modelIdentity = getPlModelIdentity(card)
    const current = itemSequenceByModel.get(modelIdentity) || 1
    const plIdentity = plIdentityMap.get(card.key)
    if (plIdentity) {
      plIdentity.model_item_count = current
    }
  })

  return cards.map((card) => ({
    ...card,
    ...(plIdentityMap.get(card.key) || { model_seq: 1, pl_letter: 'A', model_item_count: 1 }),
  }))
}

function getMultipageGroupKey(card = {}) {
  return [
    card.brand_id || normalize(card.brand_name) || 'UNBRANDED',
    card.category_id || normalize(getCategoryPathLabel(card)) || 'UNCATEGORIZED',
  ].join('::')
}

function getShortGrnLabel(grnNumber) {
  const value = String(grnNumber || '').trim()
  return value.split('-')[0] || value || 'GRN'
}

function getBreakdownIdentity(row = {}) {
  if (row.product_model_variant_id) return `variant:${row.product_model_variant_id}`
  return `model:${row.product_model_id || 'legacy'}`
}

function getPlRowQty(plRow) {
  return (plRow?.sizeRows || []).reduce((sum, sizeRow) => sum + Number(sizeRow.qty || 0), 0)
}

function getPlRowsBreakdownQty(rows = []) {
  return rows.reduce((sum, row) => sum + getPlRowQty(row), 0)
}

function normalizeSizeLabel(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '')
}

function getSummarySizeLabel(value) {
  const normalized = normalizeSizeLabel(value)
  if (!normalized.includes('X')) return normalized
  return normalized.split('X')[0] || normalized
}

function getSizeSummary(sizeRows = []) {
  const grouped = new Map()
  sizeRows
    .filter((row) => normalizeSizeLabel(row.size_label))
    .forEach((row) => {
      const size = getSummarySizeLabel(row.size_label)
      grouped.set(size, (grouped.get(size) || 0) + Number(row.qty || 0))
    })

  return Array.from(grouped.entries()).map(([size, qty]) => ({ size, qty }))
}

function getDefaultAllocationTargets(rowQty = 0, modelTotalQty = 0) {
  const normalizedQty = Math.max(0, Number(rowQty || 0))
  if (modelTotalQty <= 15) return { mobTargetQty: 0, oiTargetQty: normalizedQty }
  if (modelTotalQty <= 80) return { mobTargetQty: normalizedQty, oiTargetQty: 0 }

  const oiTargetQty = Math.ceil(normalizedQty * 0.15)
  return {
    mobTargetQty: Math.max(0, normalizedQty - oiTargetQty),
    oiTargetQty,
  }
}

function getSizeRowAllocationTargets(sizeRow = {}, modelTotalQty = 0) {
  const rowQty = Math.max(0, Number(sizeRow.qty || 0))
  const defaultTargets = getDefaultAllocationTargets(rowQty, modelTotalQty)
  const mobTargetQty = Number(sizeRow.mob_target_qty)
  const oiTargetQty = Number(sizeRow.oi_target_qty)

  if (
    Number.isFinite(mobTargetQty) &&
    Number.isFinite(oiTargetQty) &&
    mobTargetQty >= 0 &&
    oiTargetQty >= 0 &&
    mobTargetQty + oiTargetQty === rowQty
  ) {
    return { mobTargetQty, oiTargetQty }
  }

  return defaultTargets
}

function getTargetKey(breakdownId, storingType) {
  return `${Number(breakdownId || 0)}::${normalize(storingType)}`
}

function getAllocationDraftSignature(rows = [], reason = '') {
  return JSON.stringify({
    reason: String(reason || '').trim().toUpperCase(),
    rows: rows.map((row) => ({
      key: row.key,
      mob_qty: Number(row.mob_qty || 0),
      oi_qty: Number(row.oi_qty || 0),
    })),
  })
}

function formatPdfValue(value) {
  const text = String(value ?? '').trim()
  return text || '-'
}

function formatPdfQty(value) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0))
}

function getPdfGroupLabel(qtyMode = 'all') {
  if (qtyMode === 'mob') return 'MOB'
  if (qtyMode === 'oi') return 'OI'
  return 'ALL'
}

const PDF_FONT_FAMILY = 'OpenSans'
const PDF_SIZE_CHART_COLUMNS = [
  { key: 'weight_value', label: 'Weight', width: 22 },
  { key: 'length_value', label: 'Length', width: 22 },
  { key: 'width_value', label: 'Width', width: 22 },
  { key: 'width_afterpull', label: 'Width After Pull', width: 32 },
  { key: 'sleeve_length', label: 'Sleeve Length', width: 30 },
  { key: 'thigh_width', label: 'Thigh Width', width: 28 },
]

async function getFileBase64(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to load PDF font: ${url}`)
  const blob = await response.blob()
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result || '').split(',')[1] || '')
    reader.onerror = () => reject(new Error(`Failed to read PDF font: ${url}`))
    reader.readAsDataURL(blob)
  })
}

async function registerPdfFonts(doc) {
  const [regularFont, semiboldFont] = await Promise.all([
    getFileBase64('/fonts/open-sans/OpenSans-Regular.ttf'),
    getFileBase64('/fonts/open-sans/OpenSans-SemiBold.ttf'),
  ])
  doc.addFileToVFS('OpenSans-Regular.ttf', regularFont)
  doc.addFileToVFS('OpenSans-SemiBold.ttf', semiboldFont)
  doc.addFont('OpenSans-Regular.ttf', PDF_FONT_FAMILY, 'normal')
  doc.addFont('OpenSans-SemiBold.ttf', PDF_FONT_FAMILY, 'bold')
  doc.setFont(PDF_FONT_FAMILY, 'normal')
}

function hasPdfMeasurementValue(value) {
  const text = String(value ?? '').trim()
  return Boolean(text && text !== '-')
}

function buildPdfSizeChartGroups(rows = []) {
  const rowsByPlId = new Map()
  rows.forEach((row) => {
    const plId = formatPdfValue(row.pl_id)
    const current = rowsByPlId.get(plId) || []
    current.push(row)
    rowsByPlId.set(plId, current)
  })

  const groupsBySignature = new Map()
  rowsByPlId.forEach((plRows, plId) => {
    const canonicalRows = plRows
      .map((row) => ({
        size_label: formatPdfValue(row.size_label),
        ...Object.fromEntries(
          PDF_SIZE_CHART_COLUMNS.map((column) => [column.key, formatPdfValue(row[column.key])])
        ),
      }))
      .sort((a, b) => a.size_label.localeCompare(b.size_label, undefined, { numeric: true }))
    const signature = JSON.stringify(canonicalRows)
    const current = groupsBySignature.get(signature) || {
      plIds: [],
      rows: plRows,
    }
    current.plIds.push(plId)
    groupsBySignature.set(signature, current)
  })

  return Array.from(groupsBySignature.values()).map((group) => {
    const visibleMeasurementColumns = PDF_SIZE_CHART_COLUMNS.filter((column) =>
      group.rows.some((row) => hasPdfMeasurementValue(row[column.key]))
    )
    return {
      ...group,
      headers: [
        { key: 'size_label', label: 'Size', width: 22 },
        ...visibleMeasurementColumns,
      ],
    }
  })
}

function toPdfTitleCase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/(^|[\s/-])([a-z])/g, (match, prefix, letter) => `${prefix}${letter.toUpperCase()}`)
}

function formatPdfPrintDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value)
}

async function getImageDataUrl(url) {
  if (!url) return ''
  try {
    const response = await fetch(url)
    if (!response.ok) return ''
    const blob = await response.blob()
    const originalDataUrl = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result || ''))
      reader.onerror = () => resolve('')
      reader.readAsDataURL(blob)
    })

    try {
      const bitmap = await createImageBitmap(blob)
      const maxSide = 1200
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close()
      return canvas.toDataURL('image/jpeg', 0.88)
    } catch {
      return originalDataUrl
    }
  } catch {
    return ''
  }
}

function paintPdfPageBackground(doc) {
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F')
}

function getPdfImageFormat(imageData) {
  if (imageData?.startsWith('data:image/png')) return 'PNG'
  if (imageData?.startsWith('data:image/webp')) return 'WEBP'
  return 'JPEG'
}

function drawPdfImageContain(doc, imageData, x, y, width, height) {
  if (!imageData) return false

  try {
    const properties = doc.getImageProperties(imageData)
    const sourceWidth = Number(properties?.width || width)
    const sourceHeight = Number(properties?.height || height)
    const ratio = Math.min(width / sourceWidth, height / sourceHeight)
    const renderedWidth = Math.max(1, sourceWidth * ratio)
    const renderedHeight = Math.max(1, sourceHeight * ratio)
    doc.addImage(
      imageData,
      getPdfImageFormat(imageData),
      x + (width - renderedWidth) / 2,
      y + (height - renderedHeight) / 2,
      renderedWidth,
      renderedHeight
    )
    return true
  } catch {
    return false
  }
}

function getPdfCellLines(doc, value, width, height, fontSize = 7) {
  const lineHeight = fontSize * 0.43
  const maxLines = Math.max(1, Math.floor((height - 4) / lineHeight))
  const lines = doc.splitTextToSize(formatPdfValue(value), Math.max(width - 4, 6))
  if (lines.length <= maxLines) return { lines, lineHeight }

  const visibleLines = lines.slice(0, maxLines)
  const lastIndex = visibleLines.length - 1
  const lastLine = String(visibleLines[lastIndex] || '')
  visibleLines[lastIndex] = `${lastLine.slice(0, Math.max(1, lastLine.length - 3))}...`
  return { lines: visibleLines, lineHeight }
}

function drawPdfCellText(doc, value, x, y, width, height, options = {}) {
  const {
    align = 'left',
    bold = false,
    fontSize = 7,
    color = [15, 23, 42],
  } = options
  doc.setFont(PDF_FONT_FAMILY, bold ? 'bold' : 'normal')
  doc.setFontSize(fontSize)
  doc.setTextColor(...color)
  const { lines, lineHeight } = getPdfCellLines(doc, value, width, height, fontSize)
  const textHeight = lines.length * lineHeight
  const textY = y + Math.max(3.3, (height - textHeight) / 2 + lineHeight * 0.78)
  const textX = align === 'center' ? x + width / 2 : align === 'right' ? x + width - 2 : x + 2
  doc.text(lines, textX, textY, { align })
}

function groupPdfProductRows(rows = []) {
  const groups = new Map()

  rows.forEach((row, rowIndex) => {
    const key = row.product_key || [row.pl_id, row.item_name, row.photo_url, row.brand_name].join('::')
    const current = groups.get(key) || {
      key,
      firstIndex: rowIndex,
      identity: row,
      rows: [],
    }
    current.rows.push(row)
    groups.set(key, current)
  })

  return Array.from(groups.values()).sort((a, b) => a.firstIndex - b.firstIndex)
}

function drawPdfProductTable(doc, config) {
  const {
    title,
    rows,
    startY,
    margin = 10,
    imageCache = new Map(),
    emptyText = 'No data.',
    onPageBreak,
    picKey = 'data_pic',
    picLabel = 'PIC Data',
  } = config
  const pageHeight = doc.internal.pageSize.getHeight()
  const pageBottom = pageHeight - margin - 7
  const columns = [
    { key: 'pl_id', label: 'PL ID', width: 14, merged: true, align: 'center' },
    { key: 'item_name', label: 'Brand / Model / Variant / Detail', width: 66, merged: true },
    { key: 'size_label', label: 'Size', width: 16, align: 'center' },
    { key: 'qty', label: 'Qty', width: 13, align: 'center' },
    { key: 'total_qty', label: 'Total', width: 15, merged: true, align: 'center', accent: true },
    { key: picKey, label: picLabel, width: 30, align: 'center' },
    { key: 'photo_url', label: 'Photo', width: 36, merged: true, image: true },
  ]
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0)
  const headerHeight = 9
  let y = startY

  if (y + 18 > pageBottom) {
    doc.addPage()
    y = typeof onPageBreak === 'function' ? onPageBreak() : margin
  }

  const drawSectionHeading = (continued = false) => {
    doc.setFont(PDF_FONT_FAMILY, 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text(`${title}${continued ? ' (continued)' : ''}`, margin, y)
    y += 5
  }

  const drawHeader = () => {
    let x = margin
    doc.setLineWidth(0.2)
    columns.forEach((column) => {
      doc.setFillColor(15, 23, 42)
      doc.setDrawColor(15, 23, 42)
      doc.rect(x, y, column.width, headerHeight, 'FD')
      drawPdfCellText(doc, column.label, x, y, column.width, headerHeight, {
        align: 'center',
        bold: true,
        fontSize: 6.7,
        color: [255, 255, 255],
      })
      x += column.width
    })
    y += headerHeight
  }

  const startContinuationPage = () => {
    doc.addPage()
    y = typeof onPageBreak === 'function' ? onPageBreak() : margin
    drawSectionHeading(true)
    drawHeader()
  }

  drawSectionHeading(false)
  if (!rows.length) {
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(margin, y, tableWidth, 15, 2, 2, 'FD')
    drawPdfCellText(doc, emptyText, margin, y, tableWidth, 15, {
      align: 'center',
      color: [100, 116, 139],
    })
    return y + 23
  }

  drawHeader()
  const groupedRows = groupPdfProductRows(rows)
  const drawableGroups = groupedRows.flatMap((group) => {
    const chunks = []
    for (let index = 0; index < group.rows.length; index += 14) {
      chunks.push({
        ...group,
        rows: group.rows.slice(index, index + 14),
        continued: index > 0,
      })
    }
    return chunks
  })

  drawableGroups.forEach((group, groupIndex) => {
    const minimumHeight = group.rows.length > 1 ? 41 : 25
    const groupHeight = Math.max(minimumHeight, group.rows.length * 8.5)
    const detailRowHeight = groupHeight / group.rows.length

    if (y + groupHeight > pageBottom) startContinuationPage()

    const groupFill = groupIndex % 2 === 0 ? [255, 255, 255] : [248, 250, 252]
    let x = margin
    columns.forEach((column) => {
      const cellHeight = column.merged ? groupHeight : detailRowHeight
      if (column.merged) {
        doc.setFillColor(...(column.accent ? [240, 253, 244] : groupFill))
        doc.setDrawColor(203, 213, 225)
        doc.rect(x, y, column.width, groupHeight, 'FD')

        if (column.image) {
          const imageData = imageCache.get(group.identity[column.key])
          const inset = groupHeight > 32 ? 3 : 2
          const imageWidth = column.width - inset * 2
          const imageDrawn = drawPdfImageContain(
            doc,
            imageData,
            x + inset,
            y + inset,
            imageWidth,
            groupHeight - inset * 2
          )
          if (!imageDrawn) {
            drawPdfCellText(doc, 'No photo', x + inset, y, imageWidth, groupHeight, {
              align: 'center',
              fontSize: 6.5,
              color: [148, 163, 184],
            })
          }
        } else if (column.key === 'item_name') {
          const inset = 3
          const itemWidth = column.width - inset * 2
          const itemTitle = [
            toPdfTitleCase(group.identity.brand_name),
            toPdfTitleCase(group.identity.item_name),
          ].filter(Boolean).join(' ')
          doc.setFont(PDF_FONT_FAMILY, 'bold')
          doc.setFontSize(7.8)
          doc.setTextColor(15, 23, 42)
          const titleLines = doc.splitTextToSize(itemTitle || '-', itemWidth).slice(0, 3)
          const titleLineHeight = 3.5
          const notes = String(group.identity.pl_notes || '').trim()
          let noteLines = []
          let noteLineHeight = 0
          if (notes) {
            doc.setFont(PDF_FONT_FAMILY, 'normal')
            doc.setFontSize(5.8)
            const notesHeight = Math.max(4, groupHeight - inset * 2 - titleLines.length * titleLineHeight - 1)
            const noteText = getPdfCellLines(doc, notes, itemWidth, notesHeight, 5.8)
            noteLines = noteText.lines
            noteLineHeight = noteText.lineHeight
          }

          const titleBlockHeight = titleLines.length * titleLineHeight
          const notesBlockHeight = noteLines.length ? 1 + noteLines.length * noteLineHeight : 0
          const blockHeight = titleBlockHeight + notesBlockHeight
          const blockTop = y + Math.max(inset, (groupHeight - blockHeight) / 2)

          doc.setFont(PDF_FONT_FAMILY, 'bold')
          doc.setFontSize(7.8)
          doc.setTextColor(15, 23, 42)
          doc.text(titleLines, x + inset, blockTop + titleLineHeight * 0.78)

          if (noteLines.length) {
            const notesY = blockTop + titleBlockHeight + 1
            doc.setFont(PDF_FONT_FAMILY, 'normal')
            doc.setFontSize(5.8)
            doc.setTextColor(100, 116, 139)
            doc.text(noteLines, x + inset, notesY + noteLineHeight * 0.72)
          }
        } else {
          const displayValue = column.key === 'pl_id' && group.continued
            ? `${group.identity[column.key]} (cont.)`
            : group.identity[column.key]
          drawPdfCellText(doc, displayValue, x, y, column.width, groupHeight, {
            align: column.align || 'left',
            bold: Boolean(column.accent || column.key === 'pl_id'),
            fontSize: 7,
          })
        }
      } else {
        group.rows.forEach((row, rowIndex) => {
          const rowY = y + rowIndex * detailRowHeight
          doc.setFillColor(...groupFill)
          doc.setDrawColor(203, 213, 225)
          doc.rect(x, rowY, column.width, detailRowHeight, 'FD')
          drawPdfCellText(doc, row[column.key], x, rowY, column.width, detailRowHeight, {
            align: column.align || 'left',
            fontSize: 6.8,
          })
        })
      }
      x += column.width
    })
    y += groupHeight
  })

  return y + 9
}

function getPdfTableRowHeight(doc, headers, row) {
  const cellLines = headers.map((header) => {
    if (header.type === 'image') return ['']
    return doc.splitTextToSize(formatPdfValue(row[header.key]), Math.max(header.width - 4, 8))
  })
  const textHeight = Math.max(...cellLines.map((line) => line.length)) * 3.1 + 2.5
  return Math.max(8, textHeight, headers.some((header) => header.type === 'image') ? 16 : 0)
}

function getPdfTableHeight(doc, headers, rows) {
  const rowHeight = rows.reduce((total, row) => total + getPdfTableRowHeight(doc, headers, row), 0)
  return 6 + 10 + rowHeight + 8
}

function drawPdfTable(doc, config) {
  const {
    title,
    headers,
    rows,
    startY,
    margin = 10,
    startX = margin,
    imageCache = new Map(),
    emptyText = 'No data.',
    onPageBreak,
  } = config
  const pageHeight = doc.internal.pageSize.getHeight()
  let y = startY
  if (y + 18 > pageHeight - margin - 7) {
    doc.addPage()
    y = typeof onPageBreak === 'function' ? onPageBreak() : margin
  }

  doc.setFont(PDF_FONT_FAMILY, 'bold')
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  doc.text(title, startX, y)
  y += 6

  if (!rows.length) {
    doc.setFont(PDF_FONT_FAMILY, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(emptyText, startX, y)
    return y + 8
  }

  const drawHeader = () => {
    let x = startX
    headers.forEach((header) => {
      doc.setFillColor(71, 85, 105)
      doc.setDrawColor(71, 85, 105)
      doc.rect(x, y, header.width, 10, 'FD')
      drawPdfCellText(doc, String(header.label || ''), x, y, header.width, 10, {
        align: 'center',
        bold: true,
        fontSize: 6.2,
        color: [255, 255, 255],
      })
      x += header.width
    })
    y += 10
  }

  drawHeader()

  rows.forEach((row) => {
    const cellLines = headers.map((header) => {
      if (header.type === 'image') return ['']
      return doc.splitTextToSize(formatPdfValue(row[header.key]), Math.max(header.width - 4, 8))
    })
    const rowHeight = getPdfTableRowHeight(doc, headers, row)

    if (y + rowHeight > pageHeight - margin) {
      doc.addPage()
      y = typeof onPageBreak === 'function' ? onPageBreak() : margin
      doc.setFont(PDF_FONT_FAMILY, 'bold')
      doc.setFontSize(10)
      doc.setTextColor(15, 23, 42)
      doc.text(`${title} (continued)`, startX, y)
      y += 6
      drawHeader()
    }

    let x = startX
    headers.forEach((header, index) => {
      doc.setDrawColor(226, 232, 240)
      doc.rect(x, y, header.width, rowHeight)

      if (header.type === 'image') {
        const imageData = imageCache.get(row[header.key])
        if (imageData) {
          const imageDrawn = drawPdfImageContain(doc, imageData, x + 2, y + 2, 12, 12)
          if (!imageDrawn) {
            doc.setFont(PDF_FONT_FAMILY, 'normal')
            doc.setFontSize(6)
            doc.text('-', x + 6, y + 7, { align: 'center' })
          }
        } else {
          doc.setFont(PDF_FONT_FAMILY, 'normal')
          doc.setFontSize(6)
          doc.setTextColor(100, 116, 139)
          doc.text('-', x + 6, y + 7, { align: 'center' })
        }
      } else {
        doc.setFont(PDF_FONT_FAMILY, 'normal')
        doc.setFontSize(7)
        doc.setTextColor(15, 23, 42)
        doc.text(cellLines[index], x + 2, y + 5)
      }
      x += header.width
    })

    y += rowHeight
  })

  return y + 8
}

function getAllocatedPlRowSizeSummary(plRow = {}, modelTotalQty = 0, qtyMode = 'all') {
  const allSizes = getSizeSummary(plRow.sizeRows || [])
  if (qtyMode === 'all') return allSizes

  const targetField = qtyMode === 'oi' ? 'oi_target_qty' : 'mob_target_qty'
  const hasStoredTargets = (plRow.sizeRows || []).every(
    (row) => row.mob_target_qty !== null && row.mob_target_qty !== undefined && row.oi_target_qty !== null && row.oi_target_qty !== undefined
  )

  if (hasStoredTargets) {
    const grouped = new Map()
    ;(plRow.sizeRows || []).forEach((row) => {
      const size = getSummarySizeLabel(row.size_label)
      if (!size) return
      grouped.set(size, (grouped.get(size) || 0) + Number(row[targetField] || 0))
    })
    return Array.from(grouped.entries())
      .map(([size, qty]) => ({ size, qty }))
      .filter((row) => Number(row.qty || 0) > 0)
  }

  return allSizes
    .map((row) => {
      const sizeQty = Number(row.qty || 0)
      const targets = getDefaultAllocationTargets(sizeQty, modelTotalQty)
      const targetQty = qtyMode === 'oi' ? targets.oiTargetQty : targets.mobTargetQty

      return {
        ...row,
        qty: targetQty,
      }
    })
    .filter((row) => Number(row.qty || 0) > 0)
}

function getSizeChartValues(row = {}) {
  return SIZE_CHART_FIELDS.reduce((result, field) => {
    result[field] = String(row[field] || '').trim()
    return result
  }, {})
}

function hasSizeChartValues(row = {}) {
  return SIZE_CHART_FIELDS.some((field) => String(row[field] || '').trim())
}

function getSizeChartSignature(sizeRows = []) {
  const rows = sizeRows
    .filter((row) => normalizeSizeLabel(row.size_label) && hasSizeChartValues(row))
    .map((row) => {
      const size = normalizeSizeLabel(row.size_label)
      const values = SIZE_CHART_FIELDS.map((field) => String(row[field] || '').trim().toUpperCase())
      return [size, ...values].join('~')
    })
    .sort((a, b) => a.localeCompare(b))

  return rows.join('|')
}

function getSizeChartValueMap(sizeRows = []) {
  return sizeRows.reduce((result, row) => {
    const size = normalizeSizeLabel(row.size_label)
    if (size && hasSizeChartValues(row) && !result.has(size)) {
      result.set(size, getSizeChartValues(row))
    }
    return result
  }, new Map())
}

function getSizeChartSourceLabel(card = {}, plRow = {}, rowCount = 1) {
  const modelLabel = getModelLabel(card)
  const plName = String(plRow.pl_name || '').trim().toUpperCase()

  if (rowCount > 1 && plName && normalize(plName) !== normalize(modelLabel)) {
    return `${modelLabel} - ${plName}`
  }

  return modelLabel
}

function getReturnSummary(returnRows = []) {
  return returnRows
    .filter((row) => Number(row.qty || 0) > 0)
    .map((row) => ({
      size: 'RETURN',
      qty: Number(row.qty || 0),
    }))
}

function isPackingStaffProfile(profile = {}) {
  return normalize(profile.role) === 'PACKING_STAFF'
}

function getProfileDisplayName(profile = {}) {
  const fallback = String(profile.email || '').split('@')[0]
  return String(profile.display_name || profile.name || fallback || '')
    .replace(/[._-]+/g, ' ')
    .trim()
    .toUpperCase()
}

function normalizeCheckerNames(value, fallback = '') {
  let source = value

  if (typeof source === 'string') {
    try {
      source = JSON.parse(source)
    } catch {
      source = source
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    }
  }

  const names = Array.isArray(source) ? source : []
  const fallbackNames = String(fallback || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return [...names, ...fallbackNames].reduce((result, item) => {
    const normalized = String(item || '').trim().toUpperCase()
    if (normalized && !result.includes(normalized)) {
      result.push(normalized)
    }
    return result
  }, [])
}

function getPdfCheckerFirstNames(value) {
  return normalizeCheckerNames(value).reduce((result, name) => {
    const firstName = String(name || '').trim().split(/\s+/)[0] || ''
    if (firstName && !result.includes(firstName)) result.push(firstName)
    return result
  }, [])
}

function getFirstName(value) {
  return String(value || '').trim().split(/\s+/)[0]?.toUpperCase() || '-'
}

function getBottomCategoryLabel(value) {
  const parts = String(value || '')
    .split('>')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length >= 2) {
    return [parts[parts.length - 1], parts[parts.length - 2]].join(' ')
  }
  return parts[0] || ''
}

function getPackingKoliTitle(row = {}) {
  return row.package_type === 'PHOTO' ? 'Foto' : `Koli ${row.koli_sequence || '-'}`
}

function getCheckerSummary(checkerNames = []) {
  const names = normalizeCheckerNames(checkerNames)
  if (!names.length) return 'Choose checker'
  if (names.length === 1) return names[0]
  return `${names[0]} +${names.length - 1}`
}

function getUserDisplayName(user = {}, profiles = []) {
  const userEmail = normalize(user.email)
  const userId = String(user.id || '')
  const matchedProfile = profiles.find((profile) => normalize(profile.email) === userEmail || String(profile.id || '') === userId)
  const profileName = getProfileDisplayName(matchedProfile)
  const metadataName = String(
    user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      ''
  ).trim()
  const fallbackName = String(user.email || '').split('@')[0]
  return String(profileName || metadataName || fallbackName || '')
    .replace(/[._-]+/g, ' ')
    .trim()
    .toUpperCase()
}

function serializePlRows(rows = []) {
  return JSON.stringify(
    rows.map((row) => ({
      pl_detail_seq: row.pl_detail_seq || null,
      detail_order: Number(row.detail_order || row.display_order || 0),
      pl_name: String(row.pl_name || '').trim().toUpperCase(),
      pl_notes: String(row.pl_notes || '').trim(),
      pl_photo_url: row.pl_photo_url || '',
      pl_photo_urls: normalizePhotoUrls(row.pl_photo_urls),
      returnRows: (row.returnRows || []).map((returnRow) => ({
        qty: String(returnRow.qty ?? '').trim(),
        return_reason: String(returnRow.return_reason || '').trim().toUpperCase(),
      })),
      sizeRows: (row.sizeRows || []).map((sizeRow) => ({
        size_label: normalizeSizeLabel(sizeRow.size_label),
        qty: String(sizeRow.qty ?? '').trim(),
        mob_target_qty: sizeRow.mob_target_qty ?? null,
        oi_target_qty: sizeRow.oi_target_qty ?? null,
        allocation_source: sizeRow.allocation_source || 'DEFAULT_RULE',
        allocation_reason: String(sizeRow.allocation_reason || '').trim(),
        checker_names: normalizeCheckerNames(sizeRow.checker_names),
        weight_value: String(sizeRow.weight_value || '').trim(),
        length_value: String(sizeRow.length_value || '').trim(),
        width_value: String(sizeRow.width_value || '').trim(),
      })),
    }))
  )
}

export default function PackingListSizeBreakdownPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialGrn = searchParams.get('grn') || ''
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [printingPdf, setPrintingPdf] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [plReceivingRows, setPlReceivingRows] = useState([])
  const [breakdownRows, setBreakdownRows] = useState([])
  const [packingRows, setPackingRows] = useState([])
  const [plReturnRows, setPlReturnRows] = useState([])
  const [confirmRows, setConfirmRows] = useState([])
  const [productModels, setProductModels] = useState([])
  const [catalogVariants, setCatalogVariants] = useState([])
  const [brands, setBrands] = useState([])
  const [categories, setCategories] = useState([])
  const [packingStaffProfiles, setPackingStaffProfiles] = useState([])
  const [selectedCardKey, setSelectedCardKey] = useState('')
  const [previewCardKey, setPreviewCardKey] = useState('')
  const [previewPhoto, setPreviewPhoto] = useState(null)
  const [viewMode, setViewMode] = useState('table')
  const [overviewMode, setOverviewMode] = useState('model')
  const [pageMode, setPageMode] = useState('all')
  const [selectedMultipageKey, setSelectedMultipageKey] = useState('')
  const [qtyMode, setQtyMode] = useState('all')
  const [editSection, setEditSection] = useState('breakdown')
  const [baselineSignature, setBaselineSignature] = useState('')
  const [plRows, setPlRows] = useState([])
  const [openCheckerPickerKey, setOpenCheckerPickerKey] = useState('')
  const [allocationModalOpen, setAllocationModalOpen] = useState(false)
  const [allocationDraftRows, setAllocationDraftRows] = useState([])
  const [allocationBaselineSignature, setAllocationBaselineSignature] = useState('')
  const [allocationReason, setAllocationReason] = useState('')
  const [allocationError, setAllocationError] = useState('')
  const [allocationActivePreset, setAllocationActivePreset] = useState('default')
  const [allocationHoveredPreset, setAllocationHoveredPreset] = useState('')
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [printType, setPrintType] = useState('packing_list')
  const [printRange, setPrintRange] = useState('all')
  const [printSectionKey, setPrintSectionKey] = useState('')
  const [selectedKoliPrintKeys, setSelectedKoliPrintKeys] = useState([])
  const [modelFilters, setModelFilters] = useState({
    brand: '',
    categoryPath: '',
    model: '',
  })

  useEffect(() => {
    async function enforceStaffRoute() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data: profile } = await getProfileByAuthenticatedUser(supabase, user, 'role')
      if (String(profile?.role || '').trim() === 'packing_staff' && initialGrn) {
        router.replace(`/mobile/packing-list/item-storing?grn=${encodeURIComponent(initialGrn)}`)
      }
    }

    enforceStaffRoute()
  }, [initialGrn, router])

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError('')

      const [
        { data: receivingData, error: receivingError },
        { data: breakdownData, error: breakdownError },
        { data: packingData, error: packingError },
        { data: returnData, error: returnError },
        { data: confirmData, error: confirmError },
        { data: productModelData, error: productModelError },
        { data: variantData, error: variantError },
        { data: brandData, error: brandError },
        { data: categoryData, error: categoryError },
        { data: userProfileData, error: userProfileError },
      ] = await Promise.all([
        supabase
          .from('pl_receiving')
          .select(`
            id,
            inbound_id,
            source_koli_sequence,
            product_model_id,
            product_model_variant_id,
            source_variant_code,
            model_name,
            model_color:variant_name,
            received_qty,
            qty_diff,
            validated_at,
            inbound:inbound_id (
              id,
              grn_number
            )
          `)
          .order('validated_at', { ascending: true }),
        supabase.from('pl_size_breakdown').select('*').order('detail_order', { ascending: true }).order('id', { ascending: true }),
        supabase.from('pl_packing_items').select('*').order('koli_sequence', { ascending: true }).order('id', { ascending: true }),
        supabase
          .from('warehouse_returns')
          .select('*')
          .in('source_phase', PL_RETURN_SOURCE_PHASES)
          .order('id', { ascending: true }),
        supabase
          .from('qc_confirm')
          .select('inbound_id, model_name, model_color:variant_name, photo_url')
          .order('created_at', { ascending: false }),
        supabase.from('dir_product_models').select('*').order('created_at', { ascending: true }),
        supabase.from('dir_product_model_variants').select('*').order('id', { ascending: true }),
        supabase.from('dir_brands').select('*').order('brand_name', { ascending: true }),
        supabase.from('dir_categories').select('*').order('full_code', { ascending: true }),
        supabase.from('dir_user_profiles').select('*').order('display_name', { ascending: true }),
      ])

      if (receivingError || breakdownError || returnError || confirmError || productModelError || variantError || brandError || categoryError) {
        setError(
          receivingError?.message ||
            breakdownError?.message ||
            returnError?.message ||
            confirmError?.message ||
            productModelError?.message ||
            variantError?.message ||
            brandError?.message ||
            categoryError?.message ||
            'Failed to load size breakdown data.'
        )
        setLoading(false)
        return
      }

      setPlReceivingRows(receivingData || [])
      setBreakdownRows(breakdownData || [])
      setPackingRows(packingError ? [] : packingData || [])
      setPlReturnRows(returnData || [])
      setConfirmRows(confirmData || [])
      setProductModels(productModelData || [])
      setCatalogVariants(variantData || [])
      setBrands(brandData || [])
      setCategories(categoryData || [])
      setPackingStaffProfiles(userProfileError ? [] : (userProfileData || []).filter(isPackingStaffProfile))
      setLoading(false)
    }

    loadData()
  }, [])

  const catalogContext = useMemo(() => {
    const brandById = new Map()
    brands.forEach((brand) => {
      brandById.set(Number(brand.id || 0), brand)
    })

    const categoryById = new Map()
    categories.forEach((category) => {
      categoryById.set(Number(category.id || 0), category)
    })

    const modelById = new Map()
    const modelByName = new Map()
    productModels.forEach((model) => {
      modelById.set(Number(model.id), model)
      modelByName.set(normalize(model.model_name), model)
    })

    const variantById = new Map()
    catalogVariants.forEach((variant) => {
      variantById.set(Number(variant.id), variant)
    })

    const variantByModelAndName = new Map()
    catalogVariants.forEach((variant) => {
      const modelId = Number(variant.product_model_id || 0)
      ;[variant.variant_code, variant.variant_label, variant.variant_name].forEach((value) => {
        const key = `${modelId}::${normalize(value)}`
        if (normalize(value) && !variantByModelAndName.has(key)) {
          variantByModelAndName.set(key, variant)
        }
      })
    })

    return { brandById, categoryById, modelById, modelByName, variantById, variantByModelAndName }
  }, [brands, catalogVariants, categories, productModels])

  const photoMap = useMemo(() => {
    const nextMap = new Map()
    confirmRows.forEach((row) => {
      const key = `${row.inbound_id}::${getModelKey(row.model_name, row.model_color)}`
      if (!nextMap.has(key) && row.photo_url) {
        nextMap.set(key, row.photo_url)
      }
    })
    return nextMap
  }, [confirmRows])

  const cards = useMemo(() => {
    const grouped = new Map()

    plReceivingRows
      .filter((row) => row.inbound?.grn_number === initialGrn)
      .forEach((row) => {
        const fallbackModel = catalogContext.modelByName.get(normalize(row.model_name)) || null
        const productModelId = Number(row.product_model_id || fallbackModel?.id || 0) || null
        const catalogVariant =
          catalogContext.variantById.get(Number(row.product_model_variant_id || 0)) ||
          catalogContext.variantByModelAndName.get(`${Number(productModelId || 0)}::${normalize(row.model_color)}`) ||
          null
        const productModelVariantId = Number(row.product_model_variant_id || catalogVariant?.id || 0) || null
        const catalogModel = catalogContext.modelById.get(Number(productModelId || 0)) || fallbackModel || null
        const brand = catalogContext.brandById.get(Number(catalogModel?.brand_id || row.brand_id || 0)) || null
        const category = catalogContext.categoryById.get(Number(catalogModel?.category_id || row.category_id || 0)) || null
        const categoryPath = getCategoryPath(category, catalogContext.categoryById)
        const sourceVariantCode = getVariantCode(catalogVariant) || row.source_variant_code || ''
        const key = productModelVariantId ? `variant:${productModelVariantId}` : `model:${productModelId || getModelKey(row.model_name, row.model_color)}`
        const photoKey = `${row.inbound_id}::${getModelKey(row.model_name, row.model_color)}`
        const current = grouped.get(key) || {
          key,
          inbound_id: row.inbound_id,
          grn_number: row.inbound?.grn_number || initialGrn,
          product_model_id: productModelId,
          product_model_variant_id: productModelVariantId,
          source_variant_code: sourceVariantCode,
          brand_id: catalogModel?.brand_id || row.brand_id || null,
          category_id: catalogModel?.category_id || row.category_id || null,
          brand_code: brand?.brand_code || '',
          brand_name: brand?.brand_name || brand?.name || 'UNBRANDED',
          category_code: category?.full_code || category?.category_code || '',
          category_name: category?.full_name || category?.category_name || '',
          category_path: categoryPath,
          category_root: categoryPath[0] || '',
          sub_category: categoryPath[1] || '',
          item_type: categoryPath[2] || '',
          model_code: catalogModel?.model_code || '',
          variant_code: getVariantCode(catalogVariant) || sourceVariantCode || '',
          model_name: row.model_name || catalogModel?.model_name || '',
          catalogName: getCatalogName(catalogVariant) || row.model_color || '',
          catalogVariant,
          photo_url: photoMap.get(photoKey) || catalogVariant?.variant_photo_url || '',
          receiving_qty: 0,
          firstSort: new Date(row.validated_at || 0).getTime() || Number(row.id || 0),
          registrationOrder: Number(row.id || 0),
        }

        current.receiving_qty += Number(row.received_qty || 0)
        current.brand_name = current.brand_name || brand?.brand_name || brand?.name || 'UNBRANDED'
        current.brand_code = current.brand_code || brand?.brand_code || ''
        current.category_code = current.category_code || category?.full_code || category?.category_code || ''
        current.category_name = current.category_name || category?.full_name || category?.category_name || ''
        current.category_path = current.category_path?.length ? current.category_path : categoryPath
        current.category_root = current.category_root || categoryPath[0] || ''
        current.sub_category = current.sub_category || categoryPath[1] || ''
        current.item_type = current.item_type || categoryPath[2] || ''
        current.model_code = current.model_code || catalogModel?.model_code || ''
        current.variant_code = current.variant_code || getVariantCode(catalogVariant) || sourceVariantCode || ''
        current.source_variant_code = current.source_variant_code || sourceVariantCode
        current.photo_url = current.photo_url || photoMap.get(photoKey) || catalogVariant?.variant_photo_url || ''
        current.firstSort = Math.min(current.firstSort || Number(row.id || 0), new Date(row.validated_at || 0).getTime() || Number(row.id || 0))
        current.registrationOrder = Math.min(current.registrationOrder || Number(row.id || 0), Number(row.id || 0))
        grouped.set(key, current)
      })

    const breakdownByIdentity = new Map()
    breakdownRows
      .filter((row) => row.inbound_id && plReceivingRows.some((receiving) => receiving.inbound_id === row.inbound_id && receiving.inbound?.grn_number === initialGrn))
      .forEach((row) => {
        const key = getBreakdownIdentity(row)
        breakdownByIdentity.set(key, (breakdownByIdentity.get(key) || 0) + Number(row.qty || 0))
      })

    const sortedCards = Array.from(grouped.values()).sort(
      (a, b) => b.receiving_qty - a.receiving_qty || a.firstSort - b.firstSort || getModelLabel(a).localeCompare(getModelLabel(b))
    )

    return assignPlIdentities(sortedCards).map((card) => ({
      ...card,
      breakdown_qty: breakdownByIdentity.get(card.product_model_variant_id ? `variant:${card.product_model_variant_id}` : `model:${card.product_model_id}`) || 0,
    }))
  }, [breakdownRows, catalogContext, initialGrn, photoMap, plReceivingRows])

  const selectedCard = cards.find((card) => card.key === selectedCardKey) || null

  const summary = useMemo(() => {
    const plReceivingQty = cards.reduce((sum, card) => sum + Number(card.receiving_qty || 0), 0)
    const breakdownQty = cards.reduce((sum, card) => sum + Number(card.breakdown_qty || 0), 0)
    return {
      availableModels: cards.length,
      plReceivingQty,
      breakdownQty,
      remainingQty: plReceivingQty - breakdownQty,
    }
  }, [cards])

  const multipageGroups = useMemo(() => {
    const grouped = new Map()
    cards.forEach((card) => {
      const key = getMultipageGroupKey(card)
      const current = grouped.get(key) || {
        key,
        brand_name: card.brand_name || 'UNBRANDED',
        category_path_label: getCategoryPathLabel(card),
        firstSort: card.firstSort || 0,
        registrationOrder: card.registrationOrder || Number.MAX_SAFE_INTEGER,
        cards: [],
      }
      current.cards.push(card)
      current.firstSort = Math.min(current.firstSort || card.firstSort || 0, card.firstSort || 0)
      current.registrationOrder = Math.min(
        current.registrationOrder || Number.MAX_SAFE_INTEGER,
        card.registrationOrder || Number.MAX_SAFE_INTEGER
      )
      grouped.set(key, current)
    })

    const fullGrnLabel = String(initialGrn || '-').trim()
    const shortGrnLabel = getShortGrnLabel(initialGrn)
    return Array.from(grouped.values())
      .sort(
        (a, b) =>
          a.registrationOrder - b.registrationOrder ||
          `${a.brand_name}-${a.category_path_label}`.localeCompare(`${b.brand_name}-${b.category_path_label}`)
      )
      .map((group, index) => ({
        ...group,
        page_label: `${shortGrnLabel}.${getLetterFromIndex(index + 1)}`,
        print_label: `${fullGrnLabel}.${getLetterFromIndex(index + 1)}`,
        cards: assignPlIdentities(group.cards),
      }))
  }, [cards, initialGrn])

  const effectiveModelFilters = useMemo(
    () => (pageMode === 'multipage' ? { ...modelFilters, brand: '', categoryPath: '' } : modelFilters),
    [modelFilters, pageMode]
  )
  function cardHasVisibleModelQty(card) {
    const rows = buildRowsForCard(card)
    const modelTotalQty = getPlRowsBreakdownQty(rows)

    return rows.some((plRow) => {
      const sizes = [
        ...getAllocatedPlRowSizeSummary(plRow, modelTotalQty, qtyMode),
        ...(qtyMode === 'all' ? getReturnSummary(plRow.returnRows) : []),
      ]
      const totalQty = sizes.reduce((sum, size) => sum + Number(size.qty || 0), 0)
      return qtyMode === 'all' ? sizes.length > 0 : totalQty > 0
    })
  }

  function cardHasVisibleKoliQty(card) {
    const breakdownIds = buildRowsForCard(card)
      .flatMap((plRow) => plRow.sizeRows || [])
      .map((sizeRow) => Number(sizeRow.breakdown_row_id || 0))
      .filter(Boolean)

    if (!breakdownIds.length) return false
    const breakdownIdSet = new Set(breakdownIds)
    return packingRows.some((row) => {
      if (!breakdownIdSet.has(Number(row.pl_size_breakdown_id || 0))) return false
      if (qtyMode !== 'all' && normalize(row.storing_type) !== normalize(qtyMode)) return false
      return Number(row.qty || 0) > 0
    })
  }

  const visibleMultipageGroups = multipageGroups.filter((group) =>
    group.cards.some((card) => {
      if (!matchesModelFilter(card, effectiveModelFilters)) return false
      return overviewMode === 'koli' ? cardHasVisibleKoliQty(card) : cardHasVisibleModelQty(card)
    })
  )
  useEffect(() => {
    if (pageMode !== 'multipage') return
    if (!visibleMultipageGroups.length) {
      if (selectedMultipageKey) setSelectedMultipageKey('')
      return
    }
    if (!visibleMultipageGroups.some((group) => group.key === selectedMultipageKey)) {
      setSelectedMultipageKey(visibleMultipageGroups[0].key)
    }
  }, [pageMode, selectedMultipageKey, visibleMultipageGroups])
  const activeMultipageGroup = pageMode === 'multipage'
    ? visibleMultipageGroups.find((group) => group.key === selectedMultipageKey) || visibleMultipageGroups[0] || null
    : null
  const filterBaseCards = useMemo(
    () => (pageMode === 'multipage' ? activeMultipageGroup?.cards || [] : cards),
    [activeMultipageGroup, cards, pageMode]
  )

  const modelFilterOptions = useMemo(() => {
    return {
      brands: getUniqueOptions(filterBaseCards.filter((card) => matchesModelFilter(card, effectiveModelFilters, 'brand')).map((card) => card.brand_name || 'UNBRANDED')),
      categoryPaths: getUniqueOptions(filterBaseCards.filter((card) => matchesModelFilter(card, effectiveModelFilters, 'categoryPath')).map((card) => getCategoryPathLabel(card))),
      models: getUniqueOptions(filterBaseCards.filter((card) => matchesModelFilter(card, effectiveModelFilters, 'model')).map((card) => getModelLabel(card))),
    }
  }, [effectiveModelFilters, filterBaseCards])

  const displayCards = useMemo(
    () => filterBaseCards.filter((card) => matchesModelFilter(card, effectiveModelFilters)),
    [effectiveModelFilters, filterBaseCards]
  )

  const packedQtyByTargetKey = useMemo(() => {
    return packingRows.reduce((result, row) => {
      const key = getTargetKey(row.pl_size_breakdown_id, row.storing_type)
      result.set(key, (result.get(key) || 0) + Number(row.qty || 0))
      return result
    }, new Map())
  }, [packingRows])

  function updateModelFilter(key, value) {
    setModelFilters((prev) => {
      return { ...prev, [key]: value }
    })
  }

  function resetModelFilters() {
    setModelFilters({
      brand: '',
      categoryPath: '',
      model: '',
    })
  }

  function buildRowsForCard(card, sourceBreakdownRows = breakdownRows, sourceReturnRows = plReturnRows) {
    if (!card) return []

    const identityRows = sourceBreakdownRows.filter((row) => {
      if (Number(row.inbound_id || 0) !== Number(card.inbound_id || 0)) return false
      if (Number(row.product_model_id || 0) !== Number(card.product_model_id || 0)) return false
      if (card.product_model_variant_id) {
        return Number(row.product_model_variant_id || 0) === Number(card.product_model_variant_id || 0)
      }
      return !row.product_model_variant_id
    })

    if (!identityRows.length) {
      return [createPlRow(card, null, 1)]
    }

    const grouped = new Map()
    identityRows.forEach((row, index) => {
      const groupKey = row.pl_detail_seq ? `seq:${row.pl_detail_seq}` : 'base'
      const current = grouped.get(groupKey) || {
        id: `saved-pl-${groupKey}`,
        pl_detail_seq: row.pl_detail_seq || null,
        detail_order: Number(row.detail_order || row.display_order || index + 1),
        pl_name: String(row.pl_name || row.variant_name || row.model_name || 'PL Item').toUpperCase(),
        pl_notes: row.pl_notes || row.variant_notes || '',
        pl_photo_url: row.pl_photo_url || row.variant_photo_url || card.photo_url || '',
        pl_photo_urls: normalizePhotoUrls(row.pl_photo_urls, row.pl_photo_url || row.variant_photo_url || ''),
        sizeRows: [],
        returnRows: [],
      }

      current.sizeRows.push({
        id: `saved-size-${row.id || index}`,
        breakdown_row_id: row.id || null,
        size_label: row.size_label || '',
        qty: String(row.qty ?? ''),
        mob_target_qty: row.mob_target_qty ?? null,
        oi_target_qty: row.oi_target_qty ?? null,
        allocation_source: row.allocation_source || 'DEFAULT_RULE',
        allocation_reason: row.allocation_reason || '',
        created_by: row.created_by || '',
        checker_names: normalizeCheckerNames(row.checker_names),
        weight_value: String(row.weight_value || ''),
        length_value: String(row.length_value || ''),
        width_value: String(row.width_value || ''),
        width_afterpull: String(row.width_afterpull || row.extra_value_1 || ''),
        sleeve_length: String(row.sleeve_length || row.extra_value_2 || ''),
        thigh_width: String(row.thigh_width || row.tigh_width || row.extra_value_3 || ''),
      })
      grouped.set(groupKey, current)
    })

    sourceReturnRows
      .filter((row) => {
        if (Number(row.inbound_id || 0) !== Number(card.inbound_id || 0)) return false
        if (Number(row.product_model_id || 0) && Number(row.product_model_id || 0) !== Number(card.product_model_id || 0)) return false
        if (card.product_model_variant_id && Number(row.product_model_variant_id || 0)) {
          return Number(row.product_model_variant_id || 0) === Number(card.product_model_variant_id || 0)
        }
        return normalize(row.model_name) === normalize(card.model_name) && normalize(row.variant_name) === normalize(card.catalogName)
      })
      .forEach((row, index) => {
        const groupKey = row.pl_detail_seq ? `seq:${row.pl_detail_seq}` : 'base'
        const current = grouped.get(groupKey) || {
          id: `saved-pl-return-${groupKey}`,
          pl_detail_seq: row.pl_detail_seq || null,
          detail_order: index + 1,
          pl_name: String(row.pl_name || card.catalogName || card.model_name || 'PL Item').toUpperCase(),
          pl_notes: '',
          pl_photo_url: card.photo_url || '',
          pl_photo_urls: [],
          sizeRows: [createEmptySizeRow()],
          returnRows: [],
        }

      current.returnRows.push({
        id: `saved-return-${row.id || index}`,
        warehouse_return_id: row.id || null,
        size_label: row.size_label || 'RETURN',
        koli_sequence: row.koli_sequence || null,
        qty: String(row.qty ?? ''),
        return_reason: row.return_reason || '',
      })
        grouped.set(groupKey, current)
      })

    return Array.from(grouped.values()).sort((a, b) => Number(a.detail_order || a.display_order || 0) - Number(b.detail_order || b.display_order || 0))
  }

  const sizeChartOptions = (() => {
    const groupedOptions = new Map()

    cards.forEach((card) => {
      if (card.key === selectedCardKey) return

      const sourcePlRows = buildRowsForCard(card)
      sourcePlRows.forEach((sourcePlRow) => {
        const signature = getSizeChartSignature(sourcePlRow.sizeRows)
        if (!signature) return

        const current = groupedOptions.get(signature) || {
          signature,
          productLabels: [],
          sourceSizeRows: sourcePlRow.sizeRows,
        }
        const label = getSizeChartSourceLabel(card, sourcePlRow, sourcePlRows.length)
        if (label && !current.productLabels.includes(label)) {
          current.productLabels.push(label)
        }
        groupedOptions.set(signature, current)
      })
    })

    return Array.from(groupedOptions.values())
      .map((option, index) => ({
        ...option,
        key: `size-chart-${index}`,
        label: `Same as: ${option.productLabels.join(', ')}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  })()

  function hasUnsavedChanges() {
    return viewMode !== 'table' && Boolean(selectedCardKey) && serializePlRows(plRows) !== baselineSignature
  }

  function handleSelectCard(cardKey) {
    const nextCard = cards.find((card) => card.key === cardKey) || null
    if (!nextCard) return

    if (selectedCardKey && selectedCardKey !== cardKey && hasUnsavedChanges()) {
      const shouldSwitch = window.confirm('You have unsaved changes. Switch model and discard them?')
      if (!shouldSwitch) return

      const savedRows = buildRowsForCard(nextCard)
      setSelectedCardKey(cardKey)
      setPlRows(savedRows)
      setBaselineSignature(serializePlRows(savedRows))
      closeAllocationModal(true)
      setError('')
      setSuccess('')
      return
    }

    const nextRows = buildRowsForCard(nextCard)
    setSelectedCardKey(cardKey)
    setPlRows(nextRows)
    setBaselineSignature(serializePlRows(nextRows))
    closeAllocationModal(true)
    setError('')
    setSuccess('')
  }

  function leaveEditMode() {
    if (hasUnsavedChanges()) {
      const shouldLeave = window.confirm('You have unsaved changes. Leave edit form and discard them?')
      if (!shouldLeave) return
      if (selectedCard) {
        const savedRows = buildRowsForCard(selectedCard)
        setPlRows(savedRows)
        setBaselineSignature(serializePlRows(savedRows))
        closeAllocationModal(true)
      }
    }
    setViewMode('table')
    setError('')
    setSuccess('')
  }

  function closePage() {
    if (hasUnsavedChanges()) {
      const shouldLeave = window.confirm('You have unsaved changes. Leave this page and discard them?')
      if (!shouldLeave) return
    }
    router.push('/dashboard/packing-list')
  }

  function openEditForm() {
    if (viewMode !== 'table') {
      leaveEditMode()
      return
    }

    if (!selectedCard && cards[0]) {
      const firstRows = buildRowsForCard(cards[0])
      setSelectedCardKey(cards[0].key)
      setPlRows(firstRows)
      setBaselineSignature(serializePlRows(firstRows))
    }

    setEditSection('breakdown')
    setViewMode('edit')
    setError('')
    setSuccess('')
  }

  function openPackingInput() {
    router.push(`/mobile/packing-list/item-storing?grn=${encodeURIComponent(initialGrn)}`)
  }

  function switchEditSection(nextSection) {
    setEditSection(nextSection)
    setError('')
    setSuccess('')
  }

  function hasAllocationDraftChanges() {
    if (!allocationModalOpen) return false
    return getAllocationDraftSignature(allocationDraftRows, allocationReason) !== allocationBaselineSignature
  }

  function closeAllocationModal(force = false) {
    if (!force && hasAllocationDraftChanges()) {
      const shouldClose = window.confirm('You have unsaved manual allocation changes. Close and discard them?')
      if (!shouldClose) return
    }
    setAllocationModalOpen(false)
    setAllocationDraftRows([])
    setAllocationBaselineSignature('')
    setAllocationReason('')
    setAllocationError('')
    setAllocationActivePreset('default')
    setAllocationHoveredPreset('')
  }

  function openAllocationModal() {
    if (!selectedCard) {
      setError('Choose a model card first.')
      setSuccess('')
      return
    }

    const modelVariantQty = getPlRowsBreakdownQty(plRows)
    const draftRows = plRows.flatMap((plRow, plRowIndex) =>
      plRow.sizeRows.map((sizeRow, sizeRowIndex) => {
        const rowQty = Math.max(0, Number(sizeRow.qty || 0))
        const defaultTargets = getDefaultAllocationTargets(rowQty, modelVariantQty)
        const currentTargets = getSizeRowAllocationTargets(sizeRow, modelVariantQty)
        const breakdownId = Number(sizeRow.breakdown_row_id || 0)
        return {
          key: `${plRow.id || 'pl-row'}:${sizeRow.id || 'size-row'}:${plRowIndex}:${sizeRowIndex}`,
          plRowId: plRow.id,
          sizeRowId: sizeRow.id,
          pl_id: computePlLabel(selectedCard, plRow, plRows.length),
          pl_name: String(plRow.pl_name || selectedCard.catalogName || selectedCard.model_name || '').trim().toUpperCase(),
          photo_url: plRow.pl_photo_url || selectedCard.photo_url || '',
          size_label: normalizeSizeLabel(sizeRow.size_label) || 'SIZE',
          qty: rowQty,
          mob_qty: currentTargets.mobTargetQty,
          oi_qty: currentTargets.oiTargetQty,
          default_mob_qty: defaultTargets.mobTargetQty,
          default_oi_qty: defaultTargets.oiTargetQty,
          posted_mob_qty: packedQtyByTargetKey.get(getTargetKey(breakdownId, 'MOB')) || 0,
          posted_oi_qty: packedQtyByTargetKey.get(getTargetKey(breakdownId, 'OI')) || 0,
        }
      })
    )
    const existingReason =
      plRows
        .flatMap((plRow) => plRow.sizeRows)
        .find((sizeRow) => sizeRow.allocation_source === 'MANUAL_OVERRIDE' && String(sizeRow.allocation_reason || '').trim())
        ?.allocation_reason || ''

    setAllocationDraftRows(draftRows)
    setAllocationReason(String(existingReason || '').toUpperCase())
    setAllocationBaselineSignature(getAllocationDraftSignature(draftRows, existingReason))
    setAllocationError('')
    setAllocationActivePreset(existingReason ? '' : 'default')
    setAllocationHoveredPreset('')
    setAllocationModalOpen(true)
  }

  function updateAllocationDraftQty(rowKey, field, value) {
    setAllocationDraftRows((prev) =>
      prev.map((row) => {
        if (row.key !== rowKey) return row
        const nextValue = Math.max(0, Math.floor(Number(value || 0)))
        const nextQty = Math.min(Number(row.qty || 0), nextValue)

        if (field === 'mob_qty') {
          return {
            ...row,
            mob_qty: nextQty,
            oi_qty: Math.max(0, Number(row.qty || 0) - nextQty),
          }
        }

        return {
          ...row,
          oi_qty: nextQty,
          mob_qty: Math.max(0, Number(row.qty || 0) - nextQty),
        }
      })
    )
    setAllocationError('')
    setAllocationActivePreset('')
  }

  function applyAllocationPreset(preset) {
    const modelVariantQty = getPlRowsBreakdownQty(plRows)
    setAllocationDraftRows((prev) =>
      prev.map((row) => {
        if (preset === 'mob') {
          return { ...row, mob_qty: Number(row.qty || 0), oi_qty: 0 }
        }
        if (preset === 'oi') {
          return { ...row, mob_qty: 0, oi_qty: Number(row.qty || 0) }
        }

        const sourceSizeRow = plRows
          .find((plRow) => plRow.id === row.plRowId)
          ?.sizeRows.find((sizeRow) => sizeRow.id === row.sizeRowId)
        const defaultTargets = getDefaultAllocationTargets(Number(sourceSizeRow?.qty || row.qty || 0), modelVariantQty)
        return {
          ...row,
          mob_qty: defaultTargets.mobTargetQty,
          oi_qty: defaultTargets.oiTargetQty,
          default_mob_qty: defaultTargets.mobTargetQty,
          default_oi_qty: defaultTargets.oiTargetQty,
        }
      })
    )
    if (preset === 'default') {
      setAllocationReason('')
    }
    setAllocationActivePreset(preset)
    setAllocationError('')
  }

  function applyAllocationOverride() {
    const reason = String(allocationReason || '').trim().toUpperCase()
    const hasManualOverride = allocationDraftRows.some(
      (row) => Number(row.mob_qty || 0) !== Number(row.default_mob_qty || 0) || Number(row.oi_qty || 0) !== Number(row.default_oi_qty || 0)
    )

    if (hasManualOverride && !reason) {
      setAllocationError('Reason is required for manual override.')
      return
    }

    const invalidRow = allocationDraftRows.find((row) => {
      const mobQty = Number(row.mob_qty || 0)
      const oiQty = Number(row.oi_qty || 0)
      return mobQty < 0 || oiQty < 0 || mobQty + oiQty !== Number(row.qty || 0)
    })

    if (invalidRow) {
      setAllocationError(`${invalidRow.pl_id} ${invalidRow.size_label} must keep MOB + OI equal to total qty.`)
      return
    }

    const blockedRow = allocationDraftRows.find(
      (row) =>
        Number(row.mob_qty || 0) < Number(row.posted_mob_qty || 0) ||
        Number(row.oi_qty || 0) < Number(row.posted_oi_qty || 0)
    )

    if (blockedRow) {
      setAllocationError(`${blockedRow.pl_id} ${blockedRow.size_label} cannot be lower than posted Item Storing qty.`)
      return
    }

    const draftMap = new Map(allocationDraftRows.map((row) => [row.key, row]))
    setPlRows((prev) =>
      prev.map((plRow, plRowIndex) => ({
        ...plRow,
        sizeRows: plRow.sizeRows.map((sizeRow, sizeRowIndex) => {
          const draft = draftMap.get(`${plRow.id || 'pl-row'}:${sizeRow.id || 'size-row'}:${plRowIndex}:${sizeRowIndex}`)
          if (!draft) return sizeRow

          const isManual =
            Number(draft.mob_qty || 0) !== Number(draft.default_mob_qty || 0) ||
            Number(draft.oi_qty || 0) !== Number(draft.default_oi_qty || 0)
          return {
            ...sizeRow,
            mob_target_qty: Number(draft.mob_qty || 0),
            oi_target_qty: Number(draft.oi_qty || 0),
            allocation_source: isManual ? 'MANUAL_OVERRIDE' : 'DEFAULT_RULE',
            allocation_reason: isManual ? reason : '',
          }
        }),
      }))
    )
    setSuccess(hasManualOverride ? 'MOB/OI allocation override applied. Save to persist it.' : 'MOB/OI allocation reset to default rule. Save to persist it.')
    setError('')
    closeAllocationModal(true)
  }

  function updatePlRow(plRowId, updates) {
    setPlRows((prev) => prev.map((row) => (row.id === plRowId ? { ...row, ...updates } : row)))
  }

  function updateSizeRow(plRowId, sizeRowId, updates) {
    setPlRows((prev) =>
      prev.map((row) =>
        row.id === plRowId
          ? {
              ...row,
              sizeRows: row.sizeRows.map((sizeRow) => (sizeRow.id === sizeRowId ? { ...sizeRow, ...updates } : sizeRow)),
            }
          : row
      )
    )
  }

  function toggleCheckerForSizeRow(plRowId, sizeRowId, checkerName) {
    const normalizedChecker = String(checkerName || '').trim().toUpperCase()
    if (!normalizedChecker) return

    setPlRows((prev) =>
      prev.map((row) =>
        row.id === plRowId
          ? {
              ...row,
              sizeRows: row.sizeRows.map((sizeRow) => {
                if (sizeRow.id !== sizeRowId) return sizeRow
                const checkerNames = normalizeCheckerNames(sizeRow.checker_names)
                const nextCheckerNames = checkerNames.includes(normalizedChecker)
                  ? checkerNames.filter((name) => name !== normalizedChecker)
                  : [...checkerNames, normalizedChecker]
                return {
                  ...sizeRow,
                  checker_names: nextCheckerNames,
                }
              }),
            }
          : row
      )
    )
  }

  function resetCurrentModelRows() {
    if (!selectedCard) return
    const savedRows = buildRowsForCard(selectedCard)
    setPlRows(savedRows)
    setBaselineSignature(serializePlRows(savedRows))
    setOpenCheckerPickerKey('')
    closeAllocationModal(true)
    setError('')
    setSuccess('')
  }

  function updateReturnRow(plRowId, returnRowId, updates) {
    setPlRows((prev) =>
      prev.map((row) =>
        row.id === plRowId
          ? {
              ...row,
              returnRows: (row.returnRows || []).map((returnRow) => (returnRow.id === returnRowId ? { ...returnRow, ...updates } : returnRow)),
            }
          : row
      )
    )
  }

  function addPlRow() {
    if (!selectedCard) return
    setPlRows((prev) => {
      const nextRows = prev.map((row, index) => ({
        ...row,
        pl_detail_seq: row.pl_detail_seq || index + 1,
        detail_order: index + 1,
      }))
      return [...nextRows, createPlRow(selectedCard, nextRows.length + 1, nextRows.length + 1)]
    })
  }

  function removePlRow(plRowId) {
    setPlRows((prev) => {
      if (prev.length <= 1) return prev
      return prev
        .filter((row) => row.id !== plRowId)
        .map((row, index, rows) => ({
          ...row,
          pl_detail_seq: rows.length > 1 ? index + 1 : null,
          detail_order: index + 1,
        }))
    })
  }

  function focusLastSizeInput(plRowId) {
    window.setTimeout(() => {
      const inputs = Array.from(document.querySelectorAll('[data-size-field="size"]')).filter(
        (input) => input.dataset.plRowId === plRowId
      )
      inputs[inputs.length - 1]?.focus()
    }, 80)
  }

  function addSizeRow(plRowId, shouldFocus = false) {
    setPlRows((prev) =>
      prev.map((row) =>
        row.id === plRowId
          ? {
              ...row,
              sizeRows: [...row.sizeRows, createEmptySizeRow(row.sizeRows.length)],
            }
          : row
      )
    )
    if (shouldFocus) {
      focusLastSizeInput(plRowId)
    }
  }

  function handleSizeKeyDown(event, plRowId) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    addSizeRow(plRowId, true)
  }

  function removeSizeRow(plRowId, sizeRowId) {
    setPlRows((prev) =>
      prev.map((row) =>
        row.id === plRowId
          ? {
              ...row,
              sizeRows: row.sizeRows.length <= 1 ? row.sizeRows : row.sizeRows.filter((sizeRow) => sizeRow.id !== sizeRowId),
            }
          : row
      )
    )
  }

  function addReturnRow(plRowId) {
    setPlRows((prev) =>
      prev.map((row) =>
        row.id === plRowId
          ? {
              ...row,
              returnRows: [...(row.returnRows || []), createEmptyReturnRow((row.returnRows || []).length)],
            }
          : row
      )
    )
  }

  function removeReturnRow(plRowId, returnRowId) {
    setPlRows((prev) =>
      prev.map((row) =>
        row.id === plRowId
          ? {
              ...row,
              returnRows: (row.returnRows || []).filter((returnRow) => returnRow.id !== returnRowId),
            }
          : row
      )
    )
  }

  function applySizeChartShortcut(plRowId) {
    const targetPlRow = plRows.find((row) => row.id === plRowId) || null
    const selectedOption = sizeChartOptions.find((option) => option.key === targetPlRow?.sizeChartSourceKey) || null

    if (!selectedOption) {
      setError('Choose a product size chart first.')
      setSuccess('')
      return
    }

    const sourceMap = getSizeChartValueMap(selectedOption.sourceSizeRows)
    let updatedCount = 0
    const nextRows = plRows.map((row) => {
      if (row.id !== plRowId) return row

      return {
        ...row,
        sizeRows: row.sizeRows.map((sizeRow) => {
          const sourceValues = sourceMap.get(normalizeSizeLabel(sizeRow.size_label))
          if (!sourceValues) return sizeRow

          updatedCount += 1
          return {
            ...sizeRow,
            ...sourceValues,
          }
        }),
      }
    })

    if (!updatedCount) {
      setError('No matching size found from the selected product size chart.')
      setSuccess('')
      return
    }

    setPlRows(nextRows)
    setError('')
    setSuccess(`Size chart copied from ${selectedOption.productLabels.join(', ')}.`)
  }

  async function handlePhotoChange(plRowId, event) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    try {
      setError('')
      const uploadedUrls = []
      const currentPlRow = plRows.find((row) => row.id === plRowId) || null
      const currentPlRowIndex = plRows.findIndex((row) => row.id === plRowId)
      const plDetailSegment = currentPlRow?.pl_detail_seq || currentPlRow?.detail_order || currentPlRow?.display_order || currentPlRowIndex + 1 || 'base'
      const variantSegment =
        selectedCard?.variant_code ||
        selectedCard?.source_variant_code ||
        selectedCard?.catalogName ||
        'variant'

      for (const file of files) {
        const compressedFile = await compressImageFile(file)
        const fileExt = compressedFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExt}`
        const filePath = [
          getSafeStorageSegment(selectedCard?.brand_code || selectedCard?.brand_name, 'brand'),
          getSafeStorageSegment(selectedCard?.category_code || selectedCard?.category_name || selectedCard?.category_id, 'category'),
          getSafeStorageSegment(selectedCard?.model_code || selectedCard?.model_name || selectedCard?.product_model_id, 'model'),
          'variants',
          getSafeStorageSegment(variantSegment, 'variant'),
          'detail',
          getSafeStorageSegment(plDetailSegment, 'pl'),
          fileName,
        ].join('/')

        const { error: uploadError } = await supabase.storage
          .from(PRODUCT_PHOTOS_BUCKET)
          .upload(filePath, compressedFile, { upsert: false })

        if (uploadError) {
          throw new Error(uploadError.message || 'Failed to upload PL photo detail.')
        }

        const { data: publicUrlData } = supabase.storage
          .from(PRODUCT_PHOTOS_BUCKET)
          .getPublicUrl(filePath)

        if (publicUrlData?.publicUrl) {
          uploadedUrls.push(publicUrlData.publicUrl)
        }
      }

      setPlRows((prev) =>
        prev.map((row) => {
          if (row.id !== plRowId) return row
          const nextPhotos = normalizePhotoUrls([...(row.pl_photo_urls || []), ...uploadedUrls])
          return {
            ...row,
            pl_photo_urls: nextPhotos,
          }
        })
      )
    } catch (photoError) {
      setError(photoError.message || 'Failed to upload PL photo detail.')
    } finally {
      event.target.value = ''
    }
  }

  function setMainPhoto(plRowId, photoUrl) {
    setPlRows((prev) =>
      prev.map((row) =>
        row.id === plRowId
          ? {
              ...row,
              pl_photo_url: photoUrl,
              pl_photo_urls: normalizePhotoUrls(row.pl_photo_urls),
            }
          : row
      )
    )
  }

  async function removePlPhoto(plRowId, photoUrl) {
    setPlRows((prev) =>
      prev.map((row) => {
        if (row.id !== plRowId) return row
        const nextPhotos = normalizePhotoUrls(row.pl_photo_urls).filter((item) => item !== photoUrl)
        return {
          ...row,
          pl_photo_urls: nextPhotos,
          pl_photo_url: row.pl_photo_url === photoUrl ? '' : row.pl_photo_url,
        }
      })
    )

    const storagePath = getProductPhotoStoragePath(photoUrl)
    if (!storagePath || !storagePath.includes('/variants/') || !storagePath.includes('/detail/')) return

    const { error: removeError } = await supabase.storage
      .from(PRODUCT_PHOTOS_BUCKET)
      .remove([storagePath])

    if (removeError) {
      setError(`Photo removed from form, but storage cleanup failed: ${removeError.message}`)
    }
  }

  function buildPrintSections() {
    if (pageMode === 'multipage') {
      return visibleMultipageGroups
        .map((group) => {
          const sectionCards = group.cards.filter((card) => matchesModelFilter(card, effectiveModelFilters))
          return {
            key: group.key,
            title: group.print_label,
            grn_number: group.print_label,
            brand_name: group.brand_name || 'UNBRANDED',
            category_path_label: group.category_path_label || '-',
            cards: sectionCards,
          }
        })
        .filter((section) => section.cards.length)
    }

    return [
      {
        key: 'all',
        title: initialGrn || 'Packing List',
        grn_number: initialGrn || '-',
        brand_name: modelFilters.brand || (displayCards.length === 1 ? displayCards[0]?.brand_name : 'ALL'),
        category_path_label: modelFilters.categoryPath || (displayCards.length === 1 ? getCategoryPathLabel(displayCards[0]) : 'ALL'),
        cards: displayCards,
      },
    ]
  }

  function buildPrintRowsForCards(sectionCards = []) {
    const modelRows = []
    const sizeChartRows = []
    const breakdownInfoById = new Map()

    sectionCards.forEach((card) => {
      const rows = buildRowsForCard(card)
      const modelTotalQty = getPlRowsBreakdownQty(rows)

      rows.forEach((plRow) => {
        const plId = computePlLabel(card, plRow, rows.length)
        const modelVariantLabel = getOverviewModelVariantLabel(card)
        const savedPlName = String(plRow.pl_name || '').trim()
        const isDefaultVariantOnlyName = normalize(savedPlName) === normalize(card.catalogName)
        const itemName = savedPlName && !isDefaultVariantOnlyName ? savedPlName : modelVariantLabel
        const photoUrl = plRow.pl_photo_url || card.photo_url || ''
        const printableSizeRows = (plRow.sizeRows || [])
          .map((sizeRow) => {
            const totalQty = Number(sizeRow.qty || 0)
            const targets = getSizeRowAllocationTargets(sizeRow, modelTotalQty)
            const qty = qtyMode === 'mob' ? targets.mobTargetQty : qtyMode === 'oi' ? targets.oiTargetQty : totalQty
            return { sizeRow, qty }
          })
          .filter((row) => Number(row.qty || 0) > 0 || qtyMode === 'all')
        const plRowTotalQty = printableSizeRows.reduce((sum, row) => sum + Number(row.qty || 0), 0)
        const commonRow = {
          product_key: `${card.key}::${plRow.id}`,
          photo_url: photoUrl,
          pl_notes: String(plRow.pl_notes || '').trim(),
          pl_id: plId,
          brand_name: card.brand_name || 'UNBRANDED',
          category_path: getCategoryPathLabel(card) || '-',
          item_name: itemName || '-',
          total_qty: formatPdfQty(plRowTotalQty),
        }
        const summaryRows = new Map()

        printableSizeRows.forEach(({ sizeRow, qty }) => {
          const breakdownId = Number(sizeRow.breakdown_row_id || 0)
          const sizeLabel = normalizeSizeLabel(sizeRow.size_label)
          const summarySizeLabel = getSummarySizeLabel(sizeLabel) || '-'
          const checkerNames = getPdfCheckerFirstNames(sizeRow.checker_names)
          const packingPicNames = packingRows
            .filter((packingRow) => {
              if (Number(packingRow.pl_size_breakdown_id || 0) !== breakdownId) return false
              if (qtyMode !== 'all' && normalize(packingRow.storing_type) !== normalize(qtyMode)) return false
              return true
            })
            .map((packingRow) => String(packingRow.packed_by || '').trim().toUpperCase())
            .filter(Boolean)
          const packingPic = [...new Set(packingPicNames)].join(', ') || '-'
          const dataPic = checkerNames.join(', ') || '-'
          const baseRow = {
            ...commonRow,
            size_label: sizeLabel || '-',
            qty: formatPdfQty(qty),
            data_pic: dataPic,
            packing_pic: packingPic,
          }

          const currentSummary = summaryRows.get(summarySizeLabel) || {
            qty: 0,
            checkerNames: [],
          }
          currentSummary.qty += Number(qty || 0)
          checkerNames.forEach((name) => {
            if (!currentSummary.checkerNames.includes(name)) currentSummary.checkerNames.push(name)
          })
          summaryRows.set(summarySizeLabel, currentSummary)

          sizeChartRows.push({
            pl_id: plId,
            item_name: itemName || '-',
            size_label: sizeLabel || '-',
            weight_value: formatPdfValue(sizeRow.weight_value),
            length_value: formatPdfValue(sizeRow.length_value),
            width_value: formatPdfValue(sizeRow.width_value),
            width_afterpull: formatPdfValue(sizeRow.width_afterpull),
            sleeve_length: formatPdfValue(sizeRow.sleeve_length),
            thigh_width: formatPdfValue(sizeRow.thigh_width),
          })

          if (breakdownId) {
            breakdownInfoById.set(breakdownId, {
              ...baseRow,
              raw_item_name: itemName || '-',
              raw_size_label: sizeLabel || '-',
              raw_data_pic: dataPic,
            })
          }
        })

        summaryRows.forEach((summary, sizeLabel) => {
          modelRows.push({
            ...commonRow,
            size_label: sizeLabel,
            qty: formatPdfQty(summary.qty),
            data_pic: summary.checkerNames.join(', ') || '-',
            packing_pic: '-',
          })
        })
      })
    })

    return { modelRows, sizeChartRows, breakdownInfoById }
  }

  function buildPrintKoliGroups(sectionCards = []) {
    const { breakdownInfoById, sizeChartRows } = buildPrintRowsForCards(sectionCards)
    const groups = new Map()

    packingRows
      .filter((row) => {
        const breakdownId = Number(row.pl_size_breakdown_id || 0)
        if (!breakdownInfoById.has(breakdownId)) return false
        if (qtyMode !== 'all' && normalize(row.storing_type) !== normalize(qtyMode)) return false
        return true
      })
      .forEach((row) => {
        const breakdownInfo = breakdownInfoById.get(Number(row.pl_size_breakdown_id || 0)) || {}
        const groupKey = row.packing_group_key || `${row.storing_type || 'MOB'}-${row.package_type || 'REGULAR'}-${row.brand_code || 'none'}-${row.koli_sequence || '-'}`
        const current = groups.get(groupKey) || {
          key: groupKey,
          title: `${row.storing_type || 'MOB'} / ${row.package_type === 'PHOTO' ? 'FOTO' : `KOLI ${row.koli_sequence || '-'}`}`,
          total_qty: 0,
          rows: [],
        }
        current.total_qty += Number(row.qty || 0)
        current.rows.push({
          product_key: breakdownInfo.product_key || `${breakdownInfo.pl_id || '-'}::${breakdownInfo.raw_item_name || '-'}`,
          photo_url: breakdownInfo.photo_url || '',
          pl_notes: breakdownInfo.pl_notes || '',
          pl_id: breakdownInfo.pl_id || '-',
          brand_name: breakdownInfo.brand_name || 'UNBRANDED',
          category_path: breakdownInfo.category_path || '-',
          item_name: row.pl_name || breakdownInfo.raw_item_name || '-',
          size_label: normalizeSizeLabel(row.size_label || breakdownInfo.raw_size_label) || '-',
          qty: formatPdfQty(row.qty),
          total_qty: formatPdfQty(row.qty),
          data_pic: breakdownInfo.raw_data_pic || '-',
          packing_pic: String(row.packed_by || '').trim().toUpperCase() || '-',
        })
        groups.set(groupKey, current)
      })

    const koliGroups = Array.from(groups.values()).map((group) => {
      const totalsByProduct = group.rows.reduce((result, row) => {
        const key = row.product_key || row.pl_id
        result.set(key, (result.get(key) || 0) + Number(String(row.qty || 0).replace(/,/g, '')))
        return result
      }, new Map())
      return {
        ...group,
        rows: group.rows.map((row) => ({
          ...row,
          total_qty: formatPdfQty(totalsByProduct.get(row.product_key || row.pl_id) || 0),
        })),
      }
    })

    return {
      koliGroups: koliGroups.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true })),
      sizeChartRows,
    }
  }

  async function handlePrintPdf(options = {}) {
    if (printingPdf) return

    const sections = buildPrintSections().filter((section) => !options.sectionKey || section.key === options.sectionKey)
    if (!sections.length || !sections.some((section) => section.cards.length)) {
      setError('No Packing List data to print.')
      setSuccess('')
      return
    }

    setPrintingPdf(true)
    setError('')
    setSuccess('')

    try {
      const { jsPDF } = await import('jspdf')
      const documentSectionGroups = pageMode === 'multipage'
        ? sections.map((section) => [section])
        : [sections]
      const printedAt = new Date()

      for (const documentSections of documentSectionGroups) {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      await registerPdfFonts(doc)
      paintPdfPageBackground(doc)
      const margin = 10
      const pageWidth = doc.internal.pageSize.getWidth()
      const imageUrls = new Set()
      const printData = documentSections.map((section) => {
        const payload = overviewMode === 'koli' ? buildPrintKoliGroups(section.cards) : buildPrintRowsForCards(section.cards)
        const rowsForImages = overviewMode === 'koli'
          ? payload.koliGroups.flatMap((group) => group.rows)
          : payload.modelRows
        rowsForImages.forEach((row) => {
          if (row.photo_url) imageUrls.add(row.photo_url)
        })
        return { section, payload }
      })
      const imageEntries = await Promise.all(
        Array.from(imageUrls).map(async (url) => [url, await getImageDataUrl(url)])
      )
      const imageCache = new Map(imageEntries.filter(([, dataUrl]) => dataUrl))

      const getPayloadRows = (payload) => overviewMode === 'koli'
        ? (payload.koliGroups || []).flatMap((group) => group.rows)
        : payload.modelRows || []

      const getBrandCategorySummary = (section) => {
        const labels = section.cards.map((card) => {
          const brand = toPdfTitleCase(card.brand_name || 'UNBRANDED')
          const pathParts = String(getCategoryPathLabel(card) || '')
            .split('>')
            .map((part) => part.trim())
            .filter(Boolean)
          const categoryParts = pathParts.length > 1
            ? [pathParts[pathParts.length - 1], pathParts[pathParts.length - 2]]
            : pathParts
          const category = toPdfTitleCase(categoryParts.join(' '))
          return [brand, category].filter(Boolean).join(' ')
        })
        return [...new Set(labels)]
          .map((label, index) => `(${index + 1}) ${label}`)
          .join('; ') || '-'
      }

      const drawInlineField = (label, value, x, y, fontSize = 8) => {
        doc.setFont(PDF_FONT_FAMILY, 'bold')
        doc.setFontSize(fontSize)
        doc.setTextColor(71, 85, 105)
        const labelText = `${label}:`
        doc.text(labelText, x, y)
        const valueX = x + doc.getTextWidth(labelText) + 2
        doc.setFont(PDF_FONT_FAMILY, 'normal')
        doc.setTextColor(15, 23, 42)
        doc.text(formatPdfValue(value), valueX, y)
      }

      const drawDocumentHeader = (section, payload, startY) => {
        let y = startY
        const contentWidth = pageWidth - margin * 2
        const payloadRows = getPayloadRows(payload)
        const totalQty = payloadRows.reduce(
          (sum, row) => sum + Number(String(row.qty || 0).replace(/,/g, '')),
          0
        )

        doc.setFont(PDF_FONT_FAMILY, 'bold')
        doc.setFontSize(7)
        doc.setTextColor(13, 148, 136)
        doc.text('PACKING LIST', margin, y)
        y += 6
        doc.setFont(PDF_FONT_FAMILY, 'bold')
        doc.setFontSize(19)
        doc.setTextColor(15, 23, 42)
        doc.setDrawColor(15, 23, 42)
        doc.setLineWidth(0.16)
        doc.text('SIZE BREAKDOWN REPORT', margin, y, { renderingMode: 'fillThenStroke' })
        doc.setLineWidth(0.2)

        y += 3
        const metricCardWidth = 126
        const metricWidth = metricCardWidth / 2
        const metricHeight = 18
        doc.setFillColor(248, 250, 252)
        doc.setDrawColor(203, 213, 225)
        doc.roundedRect(margin, y, metricCardWidth, metricHeight, 2.5, 2.5, 'FD')
        doc.line(margin + metricWidth, y + 4, margin + metricWidth, y + metricHeight - 4)

        const drawMetricValue = (label, value, x, valueColor = [15, 23, 42]) => {
          doc.setFont(PDF_FONT_FAMILY, 'bold')
          doc.setFontSize(6.5)
          doc.setTextColor(100, 116, 139)
          doc.text(label, x + 5, y + 6)
          doc.setFontSize(12)
          doc.setTextColor(...valueColor)
          doc.text(formatPdfValue(value), x + 5, y + 14.5)
        }
        drawMetricValue('GRN NUMBER', section.grn_number, margin)
        drawMetricValue('TOTAL QTY', `${formatPdfQty(totalQty)} PCS`, margin + metricWidth)

        y += metricHeight + 5
        doc.setFont(PDF_FONT_FAMILY, 'bold')
        doc.setFontSize(8)
        doc.setTextColor(71, 85, 105)
        const brandLabel = 'Brand:'
        doc.text(brandLabel, margin, y)
        const brandValueX = margin + doc.getTextWidth(brandLabel) + 2
        doc.setFont(PDF_FONT_FAMILY, 'normal')
        doc.setTextColor(15, 23, 42)
        const brandLines = doc.splitTextToSize(
          getBrandCategorySummary(section),
          contentWidth - (brandValueX - margin)
        )
        doc.text(brandLines, brandValueX, y)
        y += Math.max(1, brandLines.length) * 4.2 + 3

        drawInlineField('Group', getPdfGroupLabel(qtyMode), margin, y)
        y += 6
        drawInlineField('Print Date', formatPdfPrintDate(printedAt), margin, y)

        y += 5
        doc.setDrawColor(203, 213, 225)
        doc.line(margin, y, pageWidth - margin, y)
        y += 5
        return y
      }

      printData.forEach(({ section, payload }, sectionIndex) => {
        if (sectionIndex > 0) {
          doc.addPage()
          paintPdfPageBackground(doc)
        }
        const drawContinuationHeader = () => {
          paintPdfPageBackground(doc)
          return margin + 4
        }
        let cursorY = drawDocumentHeader(section, payload, margin + 4)

        const drawSizeCharts = () => {
          const chartGroups = buildPdfSizeChartGroups(payload.sizeChartRows || [])
          if (!chartGroups.length) {
            cursorY = drawPdfTable(doc, {
              title: 'Size Chart',
              headers: [{ key: 'size_label', label: 'Size', width: 22 }],
              rows: [],
              startY: cursorY,
              emptyText: '-',
              onPageBreak: drawContinuationHeader,
            })
            return
          }

          const chartGap = 8
          const pageBottom = doc.internal.pageSize.getHeight() - margin - 7
          let chartX = margin
          let chartRowY = cursorY
          let chartRowHeight = 0

          chartGroups.forEach((chartGroup) => {
            const chartTitle = `Size Chart for PL ID: ${chartGroup.plIds.join(', ')}`
            const chartWidth = chartGroup.headers.reduce((total, header) => total + header.width, 0)
            const chartHeight = getPdfTableHeight(doc, chartGroup.headers, chartGroup.rows)
            doc.setFont(PDF_FONT_FAMILY, 'bold')
            doc.setFontSize(10)
            const chartBlockWidth = Math.max(chartWidth, doc.getTextWidth(chartTitle))

            if (chartX > margin && chartX + chartBlockWidth > pageWidth - margin) {
              chartRowY += chartRowHeight + chartGap
              chartX = margin
              chartRowHeight = 0
            }

            if (chartRowY + chartHeight > pageBottom) {
              doc.addPage()
              chartRowY = drawContinuationHeader()
              chartX = margin
              chartRowHeight = 0
            }

            const chartEndY = drawPdfTable(doc, {
              title: chartTitle,
              headers: chartGroup.headers,
              rows: chartGroup.rows,
              startY: chartRowY,
              startX: chartX,
              emptyText: '-',
              onPageBreak: drawContinuationHeader,
            })
            chartRowHeight = Math.max(chartRowHeight, chartEndY - chartRowY)
            chartX += chartBlockWidth + chartGap
            cursorY = chartRowY + chartRowHeight
          })
        }

        if (overviewMode === 'koli') {
          const groups = payload.koliGroups || []
          if (!groups.length) {
            cursorY = drawPdfProductTable(doc, {
              title: 'Koli',
              rows: [],
              startY: cursorY,
              imageCache,
              emptyText: 'No posted Koli data.',
              onPageBreak: drawContinuationHeader,
              picKey: 'packing_pic',
              picLabel: 'PIC Koli',
            })
          }
          groups.forEach((group) => {
            cursorY = drawPdfProductTable(doc, {
              title: `${group.title} - ${formatPdfQty(group.total_qty)} pcs`,
              rows: group.rows,
              startY: cursorY,
              imageCache,
              onPageBreak: drawContinuationHeader,
              picKey: 'packing_pic',
              picLabel: 'PIC Koli',
            })
          })
          drawSizeCharts()
        } else {
          cursorY = drawPdfProductTable(doc, {
            title: 'Model Breakdown',
            rows: payload.modelRows || [],
            startY: cursorY,
            imageCache,
            onPageBreak: drawContinuationHeader,
            picKey: 'data_pic',
            picLabel: 'PIC Data',
          })
          drawSizeCharts()
        }
      })

      const totalPages = doc.getNumberOfPages()
      const documentGrn = documentSections[0]?.grn_number || initialGrn || '-'
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        doc.setPage(pageNumber)
        const footerY = doc.internal.pageSize.getHeight() - 6
        doc.setDrawColor(226, 232, 240)
        doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4)
        doc.setFont(PDF_FONT_FAMILY, 'normal')
        doc.setFontSize(6.5)
        doc.setTextColor(100, 116, 139)
        doc.text(`Packing List / ${formatPdfValue(documentGrn)} / ${getPdfGroupLabel(qtyMode)}`, margin, footerY)
        doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - margin, footerY, { align: 'right' })
      }

      const safeDocumentGrn = String(documentGrn).replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
      doc.save(`PL${safeDocumentGrn}.pdf`)
      }

      setSuccess(
        documentSectionGroups.length > 1
          ? `${documentSectionGroups.length} Packing List PDFs generated.`
          : 'Packing List PDF generated.'
      )
    } catch (printError) {
      setError(printError.message || 'Failed to generate Packing List PDF.')
    } finally {
      setPrintingPdf(false)
    }
  }

  async function saveBreakdown() {
    if (!selectedCard) {
      setError('Choose a model card first.')
      setSuccess('')
      return
    }

    if (!selectedCard.product_model_id) {
      setError('This PL card is missing product_model_id. Please link the catalog model before saving breakdown.')
      setSuccess('')
      return
    }

    const totalQty = plRows.reduce((sum, row) => sum + row.sizeRows.reduce((sizeSum, sizeRow) => sizeSum + Number(sizeRow.qty || 0), 0), 0)
    if (totalQty > Number(selectedCard.receiving_qty || 0)) {
      setError('Breakdown Qty cannot be greater than PL Receiving Qty.')
      setSuccess('')
      return
    }

    const invalidRow = plRows.find((row) => {
      if (!String(row.pl_name || '').trim()) return true
      return row.sizeRows.some(
        (sizeRow) =>
          !String(sizeRow.size_label || '').trim() ||
          !String(sizeRow.qty ?? '').trim() ||
          !normalizeCheckerNames(sizeRow.checker_names).length ||
          Number(sizeRow.qty || 0) < 0
      )
    })

    if (invalidRow) {
      setError('Complete every PL Name, size, qty, and checker name before saving.')
      setSuccess('')
      return
    }

    const invalidReturnRow = plRows.find((row) =>
      (row.returnRows || []).some(
        (returnRow) =>
          !String(returnRow.qty ?? '').trim() ||
          Number(returnRow.qty || 0) <= 0 ||
          !String(returnRow.return_reason || '').trim()
      )
    )

    if (invalidReturnRow) {
      setError('Complete every PL Return qty and return reason before saving.')
      setSuccess('')
      return
    }

    const invalidManualAllocation = plRows
      .flatMap((row) => row.sizeRows)
      .find((sizeRow) => {
        if (sizeRow.allocation_source !== 'MANUAL_OVERRIDE') return false
        const rowQty = Number(sizeRow.qty || 0)
        const mobTarget = Number(sizeRow.mob_target_qty)
        const oiTarget = Number(sizeRow.oi_target_qty)
        const reason = String(sizeRow.allocation_reason || '').trim()
        const postedMobQty = packedQtyByTargetKey.get(getTargetKey(sizeRow.breakdown_row_id, 'MOB')) || 0
        const postedOiQty = packedQtyByTargetKey.get(getTargetKey(sizeRow.breakdown_row_id, 'OI')) || 0

        return (
          !reason ||
          !Number.isFinite(mobTarget) ||
          !Number.isFinite(oiTarget) ||
          mobTarget < 0 ||
          oiTarget < 0 ||
          mobTarget + oiTarget !== rowQty ||
          mobTarget < postedMobQty ||
          oiTarget < postedOiQty
        )
      })

    if (invalidManualAllocation) {
      setError('Review Manual Allocation before saving. Manual override needs valid targets, reason, and cannot be lower than posted Item Storing qty.')
      setSuccess('')
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    const createdByName = getUserDisplayName(user, packingStaffProfiles)

    const normalizedRows = plRows.map((row, index) => ({
      ...row,
      pl_detail_seq: plRows.length > 1 ? row.pl_detail_seq || index + 1 : null,
      detail_order: index + 1,
    }))
    const modelVariantQty = getPlRowsBreakdownQty(normalizedRows)

    const payload = normalizedRows.flatMap((row) =>
      row.sizeRows.map((sizeRow) => {
        const checkerNames = normalizeCheckerNames(sizeRow.checker_names)
        const rowQty = Number(sizeRow.qty || 0)
        const defaultTargets = getDefaultAllocationTargets(rowQty, modelVariantQty)
        const manualReason = String(sizeRow.allocation_reason || '').trim()
        const manualMobTarget = Number(sizeRow.mob_target_qty)
        const manualOiTarget = Number(sizeRow.oi_target_qty)
        const keepsManualAllocation =
          sizeRow.allocation_source === 'MANUAL_OVERRIDE' &&
          manualReason &&
          Number.isFinite(manualMobTarget) &&
          Number.isFinite(manualOiTarget) &&
          manualMobTarget >= 0 &&
          manualOiTarget >= 0 &&
          manualMobTarget + manualOiTarget === rowQty
        return {
          id: sizeRow.breakdown_row_id || null,
          inbound_id: selectedCard.inbound_id,
          product_model_id: selectedCard.product_model_id,
          product_model_variant_id: selectedCard.product_model_variant_id || null,
          source_variant_code: selectedCard.source_variant_code || null,
          model_name: selectedCard.model_name || null,
          variant_name: selectedCard.catalogName || null,
          pl_detail_seq: row.pl_detail_seq,
          detail_order: row.detail_order,
          pl_name: String(row.pl_name || '').trim().toUpperCase(),
          checker_names: checkerNames,
          pl_notes: String(row.pl_notes || '').trim() || null,
          pl_photo_url: normalizedRows.length > 1 ? row.pl_photo_url || null : null,
          pl_photo_urls: normalizedRows.length > 1 ? normalizePhotoUrls(row.pl_photo_urls) : [],
          size_label: normalizeSizeLabel(sizeRow.size_label),
          qty: rowQty,
          mob_target_qty: keepsManualAllocation ? manualMobTarget : defaultTargets.mobTargetQty,
          oi_target_qty: keepsManualAllocation ? manualOiTarget : defaultTargets.oiTargetQty,
          allocation_source: keepsManualAllocation ? 'MANUAL_OVERRIDE' : 'DEFAULT_RULE',
          allocation_reason: keepsManualAllocation ? manualReason : null,
          weight_value: String(sizeRow.weight_value || '').trim() || null,
          length_value: String(sizeRow.length_value || '').trim() || null,
          width_value: String(sizeRow.width_value || '').trim() || null,
          width_afterpull: String(sizeRow.width_afterpull || '').trim() || null,
          sleeve_length: String(sizeRow.sleeve_length || '').trim() || null,
          thigh_width: String(sizeRow.thigh_width || '').trim() || null,
          created_by: createdByName || null,
        }
      })
    )

    const returnPayload = normalizedRows.flatMap((row) =>
      (row.returnRows || []).map((returnRow) => ({
        id: returnRow.warehouse_return_id || null,
        inbound_id: selectedCard.inbound_id,
        koli_sequence: returnRow.koli_sequence || null,
        brand_id: selectedCard.brand_id || null,
        category_id: selectedCard.category_id || null,
        model_name: selectedCard.model_name || null,
        variant_name: selectedCard.catalogName || null,
        qty: Number(returnRow.qty || 0),
        return_reason: String(returnRow.return_reason || '').trim().toUpperCase(),
        pic_name: createdByName || null,
      }))
    )

    setSaving(true)
    setError('')
    setSuccess('')

    const existingRows = breakdownRows.filter((row) => {
      if (Number(row.inbound_id || 0) !== Number(selectedCard.inbound_id || 0)) return false
      if (Number(row.product_model_id || 0) !== Number(selectedCard.product_model_id || 0)) return false
      if (selectedCard.product_model_variant_id) {
        return Number(row.product_model_variant_id || 0) === Number(selectedCard.product_model_variant_id || 0)
      }
      return !row.product_model_variant_id
    })
    const incomingIds = new Set(payload.map((row) => Number(row.id || 0)).filter(Boolean))
    const staleRows = existingRows.filter((row) => !incomingIds.has(Number(row.id || 0)))
    const existingReturnRows = plReturnRows.filter((row) => {
      if (Number(row.inbound_id || 0) !== Number(selectedCard.inbound_id || 0)) return false
      if (Number(row.product_model_id || 0) && Number(row.product_model_id || 0) !== Number(selectedCard.product_model_id || 0)) return false
      if (selectedCard.product_model_variant_id && Number(row.product_model_variant_id || 0)) {
        return Number(row.product_model_variant_id || 0) === Number(selectedCard.product_model_variant_id || 0)
      }
      return normalize(row.model_name) === normalize(selectedCard.model_name) && normalize(row.variant_name) === normalize(selectedCard.catalogName)
    })
    const incomingReturnIds = new Set(returnPayload.map((row) => Number(row.id || 0)).filter(Boolean))
    const staleReturnRows = existingReturnRows.filter((row) => !incomingReturnIds.has(Number(row.id || 0)))

    for (const row of payload) {
      const breakdownPayload = {
        inbound_id: row.inbound_id,
        product_model_id: row.product_model_id,
        product_model_variant_id: row.product_model_variant_id,
        source_variant_code: row.source_variant_code,
        model_name: row.model_name,
        variant_name: row.variant_name,
        pl_detail_seq: row.pl_detail_seq,
        detail_order: row.detail_order,
        pl_name: row.pl_name,
        checker_names: row.checker_names,
        pl_notes: row.pl_notes,
        pl_photo_url: row.pl_photo_url,
        pl_photo_urls: row.pl_photo_urls,
        size_label: row.size_label,
        qty: row.qty,
        mob_target_qty: row.mob_target_qty,
        oi_target_qty: row.oi_target_qty,
        allocation_source: row.allocation_source,
        allocation_reason: row.allocation_reason,
        weight_value: row.weight_value,
        length_value: row.length_value,
        width_value: row.width_value,
        width_afterpull: row.width_afterpull,
        sleeve_length: row.sleeve_length,
        thigh_width: row.thigh_width,
        created_by: row.created_by,
        updated_at: new Date().toISOString(),
      }

      const query = row.id
        ? supabase.from('pl_size_breakdown').update(breakdownPayload).eq('id', row.id)
        : supabase.from('pl_size_breakdown').insert([breakdownPayload])

      const { error: saveError } = await query
      if (saveError) {
        setSaving(false)
        setError(saveError.message || 'Failed to save PL size breakdown.')
        return
      }
    }

    for (const row of staleRows) {
      const { error: deleteError } = await supabase.from('pl_size_breakdown').delete().eq('id', row.id)
      if (deleteError) {
        setSaving(false)
        setError(deleteError.message || 'Failed to remove deleted PL size row.')
        return
      }
    }

    for (const row of returnPayload) {
      const warehouseReturnPayload = {
        inbound_id: row.inbound_id,
        source_phase: PL_RETURN_SOURCE_PHASE,
        koli_sequence: row.koli_sequence || null,
        brand_id: row.brand_id,
        category_id: row.category_id,
        model_name: row.model_name,
        variant_name: row.variant_name,
        qty: row.qty,
        return_reason: row.return_reason,
        pic_name: row.pic_name,
      }

      const query = row.id
        ? supabase.from('warehouse_returns').update(warehouseReturnPayload).eq('id', row.id)
        : supabase.from('warehouse_returns').insert([warehouseReturnPayload])

      const { error: returnSaveError } = await query
      if (returnSaveError) {
        setSaving(false)
        setError(returnSaveError.message || 'Failed to save PL returns.')
        return
      }
    }

    for (const row of staleReturnRows) {
      const { error: returnDeleteError } = await supabase.from('warehouse_returns').delete().eq('id', row.id)
      if (returnDeleteError) {
        setSaving(false)
        setError(returnDeleteError.message || 'Failed to remove deleted PL return row.')
        return
      }
    }

    const [
      { data: refreshedRows, error: refreshError },
      { data: refreshedReturnRows, error: refreshReturnError },
    ] = await Promise.all([
      supabase
        .from('pl_size_breakdown')
        .select('*')
        .eq('inbound_id', selectedCard.inbound_id)
        .order('detail_order', { ascending: true })
        .order('id', { ascending: true }),
      supabase
        .from('warehouse_returns')
        .select('*')
        .eq('inbound_id', selectedCard.inbound_id)
        .in('source_phase', PL_RETURN_SOURCE_PHASES)
        .order('id', { ascending: true }),
    ])

    setSaving(false)
    if (refreshError || refreshReturnError) {
      setError(refreshError?.message || refreshReturnError?.message || 'Saved, but failed to refresh PL size breakdown.')
      return
    }

    const nextBreakdownRows = [
      ...breakdownRows.filter((row) => Number(row.inbound_id || 0) !== Number(selectedCard.inbound_id || 0)),
      ...((refreshedRows || []).filter(Boolean)),
    ]
    const nextReturnRows = [
      ...plReturnRows.filter((row) => Number(row.inbound_id || 0) !== Number(selectedCard.inbound_id || 0)),
      ...((refreshedReturnRows || []).filter(Boolean)),
    ]
    setBreakdownRows(nextBreakdownRows)
    setPlReturnRows(nextReturnRows)
    const savedRows = buildRowsForCard(selectedCard, nextBreakdownRows, nextReturnRows)
    setPlRows(savedRows)
    setBaselineSignature(serializePlRows(savedRows))
    closeAllocationModal(true)
    setSuccess('PL size breakdown saved.')
  }

  if (loading) {
    return <p style={styles.emptyText}>Loading size breakdown...</p>
  }

  const overviewRows = displayCards.flatMap((card) => {
    const rows = buildRowsForCard(card)
    const modelTotalQty = getPlRowsBreakdownQty(rows)
    const rowsWithAllPlIds = rows.map((plRow) => ({
      plRow,
      allPlId: computePlLabel(card, plRow, rows.length),
    }))

    return rowsWithAllPlIds
      .map(({ plRow, allPlId }, plRowIndex) => {
        const hasSavedBreakdown = plRow.sizeRows.some((sizeRow) => sizeRow.breakdown_row_id)
        const savedPlName = String(plRow.pl_name || '').trim()
        const isDefaultVariantOnlyName = normalize(savedPlName) === normalize(card.catalogName)
        const modelVariantLabel = getOverviewModelVariantLabel(card)
        const itemName = hasSavedBreakdown && savedPlName && !isDefaultVariantOnlyName ? savedPlName : modelVariantLabel
        const sizes = [
          ...getAllocatedPlRowSizeSummary(plRow, modelTotalQty, qtyMode),
          ...(qtyMode === 'all' ? getReturnSummary(plRow.returnRows) : []),
        ]
        const totalQty = sizes.reduce((sum, size) => sum + Number(size.qty || 0), 0)

        return {
          key: `${card.key}-${plRow.id || 'pl-row'}-${plRowIndex}`,
          cardKey: card.key,
          pl_id: allPlId,
          photo_url: plRow.pl_photo_url || card.photo_url,
          brand_name: card.brand_name || 'UNBRANDED',
          model_variant: modelVariantLabel,
          item_name: itemName,
          breakdown_qty: totalQty,
          sizes,
          total_qty: totalQty,
        }
      })
      .filter((row) => qtyMode === 'all' || Number(row.total_qty || 0) > 0)
  })
  const currentInboundIds = new Set(cards.map((card) => Number(card.inbound_id || 0)).filter(Boolean))
  const breakdownById = new Map(
    breakdownRows
      .filter((row) => currentInboundIds.has(Number(row.inbound_id || 0)))
      .map((row) => [Number(row.id || 0), row])
  )
  const filteredBreakdownIds = new Set(
    displayCards
      .flatMap((card) => buildRowsForCard(card))
      .flatMap((plRow) => plRow.sizeRows || [])
      .map((sizeRow) => Number(sizeRow.breakdown_row_id || 0))
      .filter(Boolean)
  )
  const breakdownDisplayById = new Map()
  displayCards.forEach((card) => {
    const cardRows = buildRowsForCard(card)
    cardRows.forEach((plRow) => {
      const plId = computePlLabel(card, plRow, cardRows.length)
      const modelVariantLabel = getOverviewModelVariantLabel(card)
      const savedPlName = String(plRow.pl_name || '').trim()
      const isDefaultVariantOnlyName = normalize(savedPlName) === normalize(card.catalogName)
      const itemName = savedPlName && !isDefaultVariantOnlyName ? savedPlName : modelVariantLabel

      ;(plRow.sizeRows || []).forEach((sizeRow) => {
        const breakdownId = Number(sizeRow.breakdown_row_id || 0)
        if (!breakdownId) return
        breakdownDisplayById.set(breakdownId, {
          pl_id: plId,
          brand_name: card.brand_name || 'UNBRANDED',
          category_path: getCategoryPathLabel(card) || '-',
          item_name: itemName || '-',
          photo_url: plRow.pl_photo_url || card.photo_url || '',
        })
      })
    })
  })
  const packingKoliRows = Array.from(
    packingRows
      .filter((row) => {
        const breakdownId = Number(row.pl_size_breakdown_id || 0)
        if (!Number(row.inbound_id || 0) || !breakdownById.has(breakdownId)) return false
        if (filteredBreakdownIds.size && !filteredBreakdownIds.has(breakdownId)) return false
        if (qtyMode !== 'all' && normalize(row.storing_type) !== normalize(qtyMode)) return false
        return true
      })
      .reduce((result, row) => {
        const sourceBreakdown = breakdownById.get(Number(row.pl_size_breakdown_id || 0)) || {}
        const displayInfo = breakdownDisplayById.get(Number(row.pl_size_breakdown_id || 0)) || {}
        const groupKey = row.packing_group_key || `${row.storing_type || 'MOB'}-${row.package_type || 'REGULAR'}-${row.brand_code || 'none'}-${row.koli_sequence || '-'}`
        const current = result.get(groupKey) || {
          key: groupKey,
          storing_type: row.storing_type || 'MOB',
          package_type: row.package_type || 'REGULAR',
          koli_sequence: row.koli_sequence || null,
          total_qty: 0,
          items: [],
        }
        current.total_qty += Number(row.qty || 0)
        current.items.push({
          id: row.id,
          pl_id: displayInfo.pl_id || '-',
          brand_name: displayInfo.brand_name || 'UNBRANDED',
          category_path: displayInfo.category_path || '-',
          source_variant_code: row.source_variant_code || sourceBreakdown.source_variant_code || '',
          item_name: row.pl_name || displayInfo.item_name || sourceBreakdown.pl_name || sourceBreakdown.variant_name || sourceBreakdown.model_name || 'PL Item',
          size_label: normalizeSizeLabel(row.size_label || sourceBreakdown.size_label),
          qty: Number(row.qty || 0),
          packed_by: row.packed_by || '-',
        })
        result.set(groupKey, current)
        return result
      }, new Map())
      .values()
  ).sort((a, b) => `${a.storing_type}-${a.package_type}-${a.koli_sequence || '-'}`.localeCompare(`${b.storing_type}-${b.package_type}-${b.koli_sequence || '-'}`, undefined, { numeric: true }))
  const packingKoliTableRows = packingKoliRows.flatMap((koliRow) =>
    koliRow.items.map((item, itemIndex) => {
      const previousItem = koliRow.items[itemIndex - 1] || null
      const itemKey = `${normalize(item.brand_name)}::${normalize(item.item_name)}`
      const previousItemKey = previousItem ? `${normalize(previousItem.brand_name)}::${normalize(previousItem.item_name)}` : ''
      const isFirstKoliRow = itemIndex === 0
      const isFirstItemRow = isFirstKoliRow || itemKey !== previousItemKey
      return {
        ...item,
        key: `${koliRow.key}-${item.id || 'item'}-${itemIndex}`,
        koliKey: koliRow.key,
        storing_type: koliRow.storing_type,
        package_type: koliRow.package_type,
        koli_sequence: koliRow.koli_sequence,
        koli_total_qty: koliRow.total_qty,
        isFirstKoliRow,
        isFirstItemRow,
      }
    })
  )
  const printSections = buildPrintSections()
  const printableSectionOptions = printSections.map((section) => ({
    key: section.key,
    label: section.grn_number || section.title || '-',
  }))
  const hasFilteredPrintData = printSections.some((section) => {
    const payload = overviewMode === 'koli' ? buildPrintKoliGroups(section.cards) : buildPrintRowsForCards(section.cards)
    return overviewMode === 'koli'
      ? Boolean(payload.koliGroups?.length)
      : Boolean(payload.modelRows?.length)
  })
  const selectedKoliPrintRows = packingKoliRows.filter((row) => selectedKoliPrintKeys.includes(row.key))
  const activePrintGrnNumber = pageMode === 'multipage'
    ? activeMultipageGroup?.print_label || initialGrn || '-'
    : initialGrn || '-'
  const canOpenPrintModal = viewMode === 'table' && !saving && !printingPdf && (hasFilteredPrintData || packingKoliRows.length)
  const canPrintPackingListFromView = overviewMode === 'model'
  const canPrintPlCardFromView = overviewMode === 'koli'

  function toggleKoliPrintSelection(koliKey) {
    setSelectedKoliPrintKeys((prev) =>
      prev.includes(koliKey)
        ? prev.filter((key) => key !== koliKey)
        : [...prev, koliKey]
    )
  }

  function openPrintModal() {
    if (!canOpenPrintModal) return
    setPrintType(overviewMode === 'koli' ? 'pl_card' : 'packing_list')
    setPrintRange(pageMode === 'multipage' ? 'all' : 'all')
    setPrintSectionKey((current) => current || printableSectionOptions[0]?.key || '')
    setPrintModalOpen(true)
  }

  function closePrintModal() {
    if (printingPdf) return
    setPrintModalOpen(false)
  }

  function getKoliPrintReference(item) {
    const categoryLabel = getBottomCategoryLabel(item.category_path) || item.item_name || ''
    return [item.brand_name, categoryLabel]
      .filter(Boolean)
      .map((part) => toPdfTitleCase(part))
      .join(' ')
  }

  function getPrintGrnNumberForKoli(koliRow = {}) {
    const firstItem = koliRow.items?.[0] || {}
    const matchedGroup = multipageGroups.find((group) =>
      normalize(group.brand_name) === normalize(firstItem.brand_name) &&
      normalize(group.category_path_label) === normalize(firstItem.category_path)
    )
    return matchedGroup?.print_label || activePrintGrnNumber
  }

  function handlePrintPackingKoliCards(koliRows = selectedKoliPrintRows) {
    if (!koliRows.length) return

    const printWindow = window.open('', '_blank', 'width=720,height=820')
    if (!printWindow) {
      setError('Print window was blocked by the browser.')
      setSuccess('')
      return
    }

    const cardsHtml = koliRows.map((koliRow) => {
      const koliTitle = getPackingKoliTitle(koliRow)
      const groupLabel = normalize(koliRow.storing_type || 'MOB') || 'MOB'
      const cardGrnNumber = getPrintGrnNumberForKoli(koliRow)
      const totalQty = koliRow.items.reduce((sum, item) => sum + Number(item.qty || 0), 0)
      const picList = Array.from(new Set(koliRow.items.map((item) => getFirstName(item.packed_by)).filter((name) => name && name !== '-')))
      const highlightsHtml = Array.from(new Set(koliRow.items.map((item) => getKoliPrintReference(item))))
        .map((reference) => `<div>${escapeHtml(reference)}</div>`)
        .join('')
      const rowsHtml = koliRow.items
        .map((item) => `
        <tr>
          <td>${escapeHtml(item.brand_name || '-')}</td>
          <td>${escapeHtml(item.source_variant_code || '-')}</td>
          <td>${escapeHtml(item.item_name || '-')}</td>
          <td class="center">${escapeHtml(item.size_label || '-')}</td>
          <td class="qty">${escapeHtml(formatPdfQty(item.qty || 0))}</td>
        </tr>
      `)
        .join('')

      return `
    <section class="card">
      <div class="titleRow">
        <h1>Packing List Card</h1>
        <span class="group">${escapeHtml(groupLabel)}</span>
      </div>
      <div class="meta">
        <div class="box"><span class="label">GRN Number</span><span class="value">${escapeHtml(cardGrnNumber)}</span></div>
        <div class="box"><span class="label">Koli</span><span class="value">${escapeHtml(koliTitle)}</span></div>
      </div>
      <div class="highlight">${highlightsHtml || '-'}</div>
      <table>
        <thead>
          <tr>
            <th>Brand</th>
            <th>Variant Code</th>
            <th>Item</th>
            <th>Size</th>
            <th>Qty</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="total">
        <span class="totalLabel">Total Qty</span>
        <span class="totalValue">${escapeHtml(formatPdfQty(totalQty))}</span>
      </div>
      <div class="footer">
        <span class="footerLabel">PIC Koli</span>
        <span class="footerValue">${escapeHtml(picList.join(', ') || '-')}</span>
      </div>
    </section>`
    }).join('')
    const fontBaseUrl = `${window.location.origin}/fonts/open-sans`

    const printHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Packing List Card</title>
    <style>
      @page { size: A6 portrait; margin: 8mm; }
      @font-face { font-family: 'Open Sans'; src: url('${fontBaseUrl}/OpenSans-Regular.ttf') format('truetype'); font-weight: 400; }
      @font-face { font-family: 'Open Sans'; src: url('${fontBaseUrl}/OpenSans-SemiBold.ttf') format('truetype'); font-weight: 700; }
      :root { --ink: #0f172a; --muted: #64748b; --line: #cbd5e1; --soft: #f8fafc; --accent: #0f766e; }
      * { box-sizing: border-box; }
      body { margin: 0; color: var(--ink); font-family: 'Open Sans', Arial, sans-serif; }
      .card { width: 100%; border: 2px solid var(--ink); border-radius: 14px; padding: 14px; page-break-after: always; }
      .card:last-child { page-break-after: auto; }
      .titleRow { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 12px; }
      h1 { margin: 0; font-size: 33px; line-height: 1.02; font-weight: 1000; text-align: center; letter-spacing: 0.01em; -webkit-text-stroke: 0.62px var(--ink); }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
      .box { border: 1px solid var(--line); border-radius: 10px; padding: 8px; background: var(--soft); min-height: 48px; }
      .label { display: block; color: var(--muted); font-size: 9px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
      .value { display: block; margin-top: 3px; font-size: 16px; font-weight: 800; }
      .highlight { margin: 0 0 10px; color: var(--ink); font-size: 22px; font-weight: 950; line-height: 1.12; text-align: left; -webkit-text-stroke: 0.18px var(--ink); }
      .group { display: inline-flex; align-items: center; min-height: 24px; padding: 0 10px; border-radius: 999px; background: #ecfeff; color: #0e7490; font-size: 11px; font-weight: 900; white-space: nowrap; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border: 1px solid var(--line); padding: 7px; font-size: 11px; vertical-align: middle; }
      th { background: var(--ink); color: #fff; font-weight: 800; text-align: center; }
      td:first-child { font-weight: 700; }
      .center { text-align: center; }
      .qty { text-align: center; font-weight: 800; font-variant-numeric: tabular-nums; }
      .total { margin-top: 10px; border: 2px solid var(--ink); border-radius: 12px; padding: 8px; text-align: center; }
      .totalLabel { display: block; color: var(--muted); font-size: 10px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; }
      .totalValue { display: block; margin-top: 4px; font-size: 42px; line-height: 1; font-weight: 800; font-variant-numeric: tabular-nums; }
      .footer { margin-top: 6px; display: grid; grid-template-columns: 72px 1fr; gap: 8px; font-size: 10px; }
      .footerLabel { color: var(--muted); font-weight: 800; text-transform: uppercase; }
      .footerValue { font-weight: 700; }
    </style>
  </head>
  <body>
    ${cardsHtml}
    <script>window.onload = function () { window.print(); };</script>
  </body>
</html>`

    printWindow.document.open()
    printWindow.document.write(printHtml)
    printWindow.document.close()
  }

  async function handlePrintSubmit() {
    if (printType === 'pl_card') {
      if (!canPrintPlCardFromView) return
      if (!selectedKoliPrintRows.length) return
      handlePrintPackingKoliCards(selectedKoliPrintRows)
      setPrintModalOpen(false)
      return
    }

    if (!canPrintPackingListFromView) return
    await handlePrintPdf({
      sectionKey: pageMode === 'multipage' && printRange === 'certain' ? printSectionKey : '',
    })
    setPrintModalOpen(false)
  }

  const editorReceivingQty = Number(selectedCard?.receiving_qty || 0)
  const editorBreakdownQty = getPlRowsBreakdownQty(plRows)
  const editorRemainingQty = editorReceivingQty - editorBreakdownQty
  const allocationOverrideCount = plRows.reduce(
    (sum, row) => sum + row.sizeRows.filter((sizeRow) => sizeRow.allocation_source === 'MANUAL_OVERRIDE').length,
    0
  )
  const saveFeedbackMessage = saving ? 'Saving PL size breakdown...' : error || success
  const saveFeedbackColor = saving ? '#475569' : error ? '#dc2626' : '#047857'
  const hasEditorUnsavedChanges = hasUnsavedChanges()
  const checkerOptions = packingStaffProfiles.reduce((result, profile) => {
    const label = getProfileDisplayName(profile)
    if (label && !result.includes(label)) {
      result.push(label)
    }
    return result
  }, [])

  return (
    <div style={styles.wrapper}>
      <section style={styles.panel}>
        <div style={styles.header}>
          <div style={styles.headerMain}>
            <div>
              <p style={styles.eyebrow}>Packing List</p>
              <div style={styles.titleLine}>
                <h1 style={styles.title}>Size Breakdown</h1>
                <span style={styles.grnChip}>{initialGrn || '-'}</span>
              </div>
              <p style={styles.subtitle}>Split PL receiving quantities into size, measurement, and PL details before storage.</p>
            </div>
            <div style={styles.metricPillGrid}>
              <div style={styles.metricPill}>
                <span style={styles.metricPillLabel}>PL Receiving Qty</span>
                <strong style={styles.metricPillValue}>{summary.plReceivingQty}</strong>
              </div>
              <div style={styles.metricPill}>
                <span style={styles.metricPillLabel}>Breakdown Qty</span>
                <strong style={styles.metricPillValue}>{summary.breakdownQty}</strong>
              </div>
              <div style={styles.metricPill}>
                <span style={styles.metricPillLabel}>Remaining</span>
                <strong style={{ ...styles.metricPillValue, color: summary.remainingQty === 0 ? '#0f172a' : '#dc2626' }}>{summary.remainingQty}</strong>
              </div>
            </div>
          </div>

          <div style={styles.headerActions}>
            {viewMode === 'table' ? (
              <button
                type="button"
                onClick={openPackingInput}
                disabled={saving || !summary.breakdownQty}
                style={
                  saving || !summary.breakdownQty
                    ? { ...styles.toolIconButton, ...styles.toolIconButtonPrimary, ...styles.disabledButton }
                    : { ...styles.toolIconButton, ...styles.toolIconButtonPrimary }
                }
                title="Open Item Storing"
                aria-label="Open Item Storing"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 5H7.6C6.16 5 5 6.16 5 7.6V18.4C5 19.84 6.16 21 7.6 21H16.4C17.84 21 19 19.84 19 18.4V7.6C19 6.16 17.84 5 16.4 5H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M9 5C9 3.9 9.9 3 11 3H13C14.1 3 15 3.9 15 5V6.5H9V5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M9 12H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M9 16H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}
            <button
              type="button"
              onClick={openEditForm}
              disabled={saving}
              style={
                viewMode !== 'table'
                  ? { ...styles.toolIconButton, display: 'none' }
                  : saving
                    ? { ...styles.toolIconButton, ...styles.disabledButton }
                    : styles.toolIconButton
              }
              title={viewMode === 'table' ? 'Edit Form' : 'Back to Overview'}
              aria-label={viewMode === 'table' ? 'Edit Form' : 'Back to Overview'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 20H8L19 9C20.1 7.9 20.1 6.1 19 5C17.9 3.9 16.1 3.9 15 5L4 16V20Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13.5 6.5L17.5 10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            {viewMode !== 'table' ? (
              <>
              <button
                type="button"
                onClick={openAllocationModal}
                disabled={saving || !selectedCard}
                style={
                  saving || !selectedCard
                    ? { ...styles.secondaryButton, ...styles.compactActionButton, ...styles.disabledButton }
                    : { ...styles.secondaryButton, ...styles.compactActionButton }
                }
              >
                Manual Allocation{allocationOverrideCount ? ` (${allocationOverrideCount})` : ''}
              </button>
              <button
                type="button"
                onClick={openEditForm}
                disabled={saving}
                style={saving ? { ...styles.iconButton, ...styles.disabledButton } : styles.iconButton}
                title="Cancel Edit"
                aria-label="Cancel Edit"
              >
                X
              </button>
              </>
            ) : null}
            {viewMode === 'table' ? (
              <button
                type="button"
                onClick={openPrintModal}
                disabled={!canOpenPrintModal}
                style={
                  !canOpenPrintModal
                    ? { ...styles.toolIconButton, ...styles.disabledButton }
                    : styles.toolIconButton
                }
                title={printingPdf ? 'Preparing PDF' : 'Print'}
                aria-label={printingPdf ? 'Preparing PDF' : 'Print'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M7 8V4H17V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M7 17H5C3.9 17 3 16.1 3 15V11C3 9.9 3.9 9 5 9H19C20.1 9 21 9.9 21 11V15C21 16.1 20.1 17 19 17H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M7 14H17V20H7V14Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M18 12H18.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {}}
              style={{
                display: 'none',
              }}
              title="Measurement Detail"
              aria-label="Measurement Detail"
            >
              ⟷
            </button>
            {viewMode === 'table' ? (
              <button
                type="button"
                onClick={closePage}
                disabled={saving}
                style={saving ? { ...styles.iconButton, ...styles.disabledButton } : styles.iconButton}
                title="Back to Packing List overview"
                aria-label="Back to Packing List overview"
              >
                X
              </button>
            ) : null}
          </div>
        </div>

        {viewMode === 'table' && error ? <p style={styles.errorText}>{error}</p> : null}
        {viewMode === 'table' && success ? <p style={styles.successText}>{success}</p> : null}

        {viewMode === 'table' ? (
          <div style={styles.section}>
            <div style={styles.filterBar}>
              <div style={styles.segmentedToggle} role="tablist" aria-label="Packing List overview mode">
                <button
                  type="button"
                  onClick={() => setOverviewMode('model')}
                  style={{
                    ...styles.segmentedButton,
                    ...(overviewMode === 'model' ? styles.segmentedButtonActive : {}),
                  }}
                >
                  Model
                </button>
                <button
                  type="button"
                  onClick={() => setOverviewMode('koli')}
                  style={{
                    ...styles.segmentedButton,
                    ...(overviewMode === 'koli' ? styles.segmentedButtonActive : {}),
                  }}
                >
                  Koli
                </button>
              </div>
              <div style={styles.segmentedToggle} role="tablist" aria-label="Packing List page layout">
                <button
                  type="button"
                  onClick={() => setPageMode('all')}
                  style={{
                    ...styles.segmentedButton,
                    ...(pageMode === 'all' ? styles.segmentedButtonActive : {}),
                  }}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPageMode('multipage')
                    setSelectedMultipageKey((current) => current || visibleMultipageGroups[0]?.key || '')
                    setModelFilters((prev) => ({ ...prev, brand: '', categoryPath: '' }))
                  }}
                  style={{
                    ...styles.segmentedButton,
                    ...(pageMode === 'multipage' ? styles.segmentedButtonActive : {}),
                  }}
                >
                  Multipage
                </button>
              </div>
              <div style={styles.segmentedToggle} role="tablist" aria-label="Qty allocation mode">
                {[
                  ['all', 'All'],
                  ['mob', 'MOB'],
                  ['oi', 'OI'],
                ].map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setQtyMode(mode)}
                    style={{
                      ...styles.segmentedButton,
                      ...(qtyMode === mode ? styles.segmentedButtonActive : {}),
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {pageMode !== 'multipage' ? (
                <>
                  <label style={styles.filterField}>
                    <select value={modelFilters.brand} onChange={(event) => updateModelFilter('brand', event.target.value)} style={styles.filterSelect}>
                      <option value="">All Brand</option>
                      {modelFilterOptions.brands.map((brandName) => (
                        <option key={`brand-${brandName}`} value={brandName}>
                          {brandName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={styles.filterField}>
                    <select value={modelFilters.categoryPath} onChange={(event) => updateModelFilter('categoryPath', event.target.value)} style={styles.filterSelect}>
                      <option value="">All Category Path</option>
                      {modelFilterOptions.categoryPaths.map((categoryName) => (
                        <option key={`category-path-${categoryName}`} value={categoryName}>
                          {categoryName}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              <label style={styles.filterField}>
                <select value={modelFilters.model} onChange={(event) => updateModelFilter('model', event.target.value)} style={styles.filterSelect}>
                  <option value="">All Model</option>
                  {modelFilterOptions.models.map((modelName) => (
                    <option key={`model-${modelName}`} value={modelName}>
                      {modelName}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={resetModelFilters} style={styles.compactResetButton} title="Reset filters" aria-label="Reset filters">
                &#8634;
              </button>
            </div>
            <div style={pageMode === 'multipage' ? styles.multipageTableShell : undefined}>
              {pageMode === 'multipage' && visibleMultipageGroups.length ? (
                <div style={styles.multipageTabs} role="tablist" aria-label="Packing List pages">
                  {visibleMultipageGroups.map((group) => {
                    const isActive = (activeMultipageGroup?.key || '') === group.key
                    const pageTitle = [group.brand_name, group.category_path_label].filter(Boolean).join(' / ')
                    return (
                      <button
                        key={group.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => {
                          setSelectedMultipageKey(group.key)
                          setModelFilters((prev) => ({ ...prev, brand: '', categoryPath: '' }))
                        }}
                        title={pageTitle}
                        style={{
                          ...styles.multipageTabButton,
                          borderBottomColor: isActive ? '#0f766e' : 'transparent',
                          color: isActive ? '#0f766e' : '#475569',
                        }}
                      >
                        {group.page_label}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            {overviewMode === 'model' ? (
              <>
            {overviewRows.length ? (
              <div style={pageMode === 'multipage' ? styles.embeddedTableWrap : styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>PL ID</th>
                      <th style={styles.th}>Picture</th>
                      <th style={styles.th}>Brand</th>
                      <th style={styles.th}>Item Name</th>
                      <th style={styles.th}>Size / Qty</th>
                      <th style={styles.th}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewRows.map((row) => (
                      <tr key={row.key} onClick={() => handleSelectCard(row.cardKey)} style={{ cursor: 'pointer' }}>
                        <td style={styles.td}>{row.pl_id}</td>
                        <td style={styles.td}>
                          {row.photo_url ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setPreviewPhoto({ src: row.photo_url, alt: row.model_variant })
                              }}
                              style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
                            >
                              <Image src={row.photo_url} alt={row.model_variant} width={54} height={54} unoptimized style={styles.tablePhoto} />
                            </button>
                          ) : (
                            <span style={styles.tableNoPhoto}>NO</span>
                          )}
                        </td>
                        <td style={styles.td}>{row.brand_name}</td>
                        <td style={{ ...styles.td, textAlign: 'left' }}>{row.item_name}</td>
                        <td style={styles.td}>
                          {row.sizes.length ? (
                            <span style={styles.sizeSummary}>
                              {row.sizes.map((size) => (
                                <span key={`${row.key}-${size.size}`} style={styles.sizeChip}>
                                  {size.size}: {size.qty}
                                </span>
                              ))}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td style={styles.td}>{row.total_qty || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={pageMode === 'multipage' ? { ...styles.emptyText, ...styles.embeddedEmpty } : styles.emptyText}>
                {cards.length ? 'No model matches the selected filters.' : 'No PL Receiving data is ready for this GRN.'}
              </p>
            )}
              </>
            ) : (
              <>
                {packingKoliRows.length ? (
                  <div style={pageMode === 'multipage' ? styles.embeddedTableWrap : styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Select</th>
                          <th style={styles.th}>Koli</th>
                          <th style={styles.th}>Brand Name</th>
                          <th style={styles.th}>Items</th>
                          <th style={styles.th}>Size</th>
                          <th style={styles.th}>Qty / Size</th>
                          <th style={styles.th}>Total Qty</th>
                          <th style={styles.th}>PIC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {packingKoliTableRows.map((row) => {
                          const dividerStyle = row.isFirstKoliRow
                            ? styles.koliDividerCell
                            : row.isFirstItemRow
                              ? styles.itemDividerCell
                              : {}
                          return (
                            <tr key={row.key}>
                              <td style={{ ...styles.td, ...dividerStyle }}>
                                {row.isFirstKoliRow ? (
                                  <span style={styles.koliSelectCell}>
                                    <input
                                      type="checkbox"
                                      checked={selectedKoliPrintKeys.includes(row.koliKey)}
                                      onChange={() => toggleKoliPrintSelection(row.koliKey)}
                                      style={styles.koliCheckbox}
                                      aria-label={`Select ${getPackingKoliTitle(row)} for PL Card print`}
                                    />
                                  </span>
                                ) : null}
                              </td>
                              <td style={{ ...styles.td, ...dividerStyle }}>
                                {row.isFirstKoliRow ? (
                                  <span style={styles.koliTitleCell}>
                                    <span style={styles.koliName}>{getPackingKoliTitle(row)}</span>
                                    <span style={styles.koliModePill}>{row.storing_type}</span>
                                  </span>
                                ) : null}
                              </td>
                              <td style={{ ...styles.td, ...dividerStyle }}>
                                {row.isFirstItemRow ? row.brand_name : null}
                              </td>
                              <td style={{ ...styles.td, ...dividerStyle, textAlign: 'left' }}>
                                {row.isFirstItemRow ? (
                                  <span style={styles.koliItemText}>{row.item_name}</span>
                                ) : null}
                              </td>
                              <td style={{ ...styles.td, ...dividerStyle }}>
                                <span style={styles.koliFlatValue}>{row.size_label || '-'}</span>
                              </td>
                              <td style={{ ...styles.td, ...dividerStyle }}>
                                <span style={styles.koliFlatValue}>{row.qty}</span>
                              </td>
                              <td style={{ ...styles.td, ...dividerStyle }}>{row.isFirstKoliRow ? row.koli_total_qty : null}</td>
                              <td style={{ ...styles.td, ...dividerStyle }}>{row.isFirstKoliRow ? getFirstName(row.packed_by) : null}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={pageMode === 'multipage' ? { ...styles.emptyText, ...styles.embeddedEmpty } : styles.emptyText}>
                    No packing koli matches the selected filters.
                  </p>
                )}
              </>
            )}
            </div>
          </div>
        ) : null}

        {viewMode !== 'table' ? (
          <div style={styles.section}>
            {cards.length ? (
              <div style={styles.cardGrid}>
                {cards.map((card, index) => {
                  const isPreviewOpen = previewCardKey === card.key
                  return (
                    <button
                      key={card.key}
                      type="button"
                      disabled={saving}
                      onClick={() => handleSelectCard(card.key)}
                      onMouseEnter={() => setPreviewCardKey(card.key)}
                      onMouseLeave={() => setPreviewCardKey('')}
                      onFocus={() => setPreviewCardKey(card.key)}
                      onBlur={() => setPreviewCardKey('')}
                      aria-label={`Choose ${card.brand_name || 'UNBRANDED'} ${getModelLabel(card)}`}
                      style={{
                        ...styles.productCard,
                        ...(selectedCardKey === card.key ? styles.productCardActive : {}),
                        ...(isPreviewOpen ? styles.productCardPreview : {}),
                        ...(saving ? styles.lockedArea : {}),
                      }}
                    >
                      {card.photo_url ? (
                        <Image src={card.photo_url} alt={getModelLabel(card)} width={320} height={220} unoptimized style={styles.cardImage} />
                      ) : (
                        <div style={styles.noPhoto}>NO PHOTO</div>
                      )}
                      {isPreviewOpen ? (
                        <span style={{ ...styles.cardPopover, ...(index < 8 ? styles.cardPopoverBelow : {}) }}>
                          <span style={styles.cardPopoverEyebrow}>{card.brand_name || 'UNBRANDED'}</span>
                          <span style={styles.cardTitle}>{getModelLabel(card)}</span>
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p style={styles.emptyText}>No PL Receiving data is ready for this GRN.</p>
            )}

            {!selectedCard ? <p style={styles.emptyText}>Choose a model from the table or photo list first.</p> : null}

            {selectedCard ? (
              <>
                {plRows.map((plRow, plRowIndex) => {
                  const isFirstPlRow = plRowIndex === 0
                  const isLastPlRow = plRowIndex === plRows.length - 1
                  return (
                  <div key={plRow.id} style={styles.plRow}>
                    <fieldset disabled={saving} style={saving ? { ...styles.editorFieldset, ...styles.lockedArea } : styles.editorFieldset}>
                    <div style={styles.editorGrid}>
                      <div style={styles.featureCard}>
                        {plRow.pl_photo_url || selectedCard.photo_url ? (
                          <Image src={plRow.pl_photo_url || selectedCard.photo_url} alt={getModelLabel(selectedCard)} width={360} height={320} unoptimized style={styles.featureImage} />
                        ) : (
                          <div style={styles.featureNoPhoto}>NO PHOTO</div>
                        )}
                        <div style={styles.featureMeta}>
                          <div style={styles.modelLine}>
                            <span style={styles.sourceInline}>{selectedCard.source_variant_code || selectedCard.catalogName || '-'}</span>
                            <strong style={styles.modelNameStrong}>{getModelLabel(selectedCard)}</strong>
                          </div>
                          <div style={styles.field}>
                            <label style={styles.label}>PL Name</label>
                            <input value={plRow.pl_name} onChange={(event) => updatePlRow(plRow.id, { pl_name: event.target.value.toUpperCase() })} style={styles.input} />
                          </div>
                          <div style={styles.field}>
                            <label style={styles.label}>PL Notes</label>
                            <textarea value={plRow.pl_notes} onChange={(event) => updatePlRow(plRow.id, { pl_notes: event.target.value })} style={styles.textarea} />
                          </div>
                          {plRows.length > 1 ? (
                            <div style={styles.field}>
                              <div style={styles.photoDetailHeader}>
                                <label style={styles.label}>Photo Detail</label>
                                <label style={styles.photoAddButton}>
                                  + Detail
                                  <input type="file" accept="image/*" multiple onChange={(event) => handlePhotoChange(plRow.id, event)} style={styles.hiddenFileInput} />
                                </label>
                              </div>
                              {normalizePhotoUrls(plRow.pl_photo_urls).length ? (
                                <div style={styles.photoGrid}>
                                  {normalizePhotoUrls(plRow.pl_photo_urls).map((photoUrl) => {
                                    const isMainPhoto = photoUrl === plRow.pl_photo_url
                                    return (
                                      <span key={photoUrl} style={styles.photoThumbWrap}>
                                        <button
                                          type="button"
                                          onClick={() => setPreviewPhoto({ src: photoUrl, alt: `${plRow.pl_name || 'PL'} photo detail` })}
                                          onDoubleClick={() => setMainPhoto(plRow.id, photoUrl)}
                                          style={{
                                            ...styles.photoThumbButton,
                                            ...(isMainPhoto ? styles.photoThumbButtonActive : {}),
                                          }}
                                          title={isMainPhoto ? 'Main photo. Click to preview.' : 'Click to preview. Double click to set as main photo.'}
                                        >
                                          <Image src={photoUrl} alt={`${plRow.pl_name || 'PL'} photo detail`} width={62} height={62} unoptimized style={styles.photoThumbImage} />
                                        </button>
                                        {isMainPhoto ? <span style={styles.mainPhotoBadge}>MAIN</span> : null}
                                        {!isMainPhoto ? (
                                          <button type="button" onClick={() => setMainPhoto(plRow.id, photoUrl)} style={styles.setMainPhotoButton}>
                                            SET
                                          </button>
                                        ) : null}
                                        <button type="button" onClick={() => removePlPhoto(plRow.id, photoUrl)} style={styles.photoRemoveButton} aria-label="Remove photo">
                                          X
                                        </button>
                                      </span>
                                    )
                                  })}
                                </div>
                              ) : (
                                <p style={styles.emptyText}>No photo detail yet.</p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {isFirstPlRow ? (
                          <>
                            <div style={{ ...styles.headerActions, justifyContent: 'space-between', width: '100%' }}>
                              <div style={styles.editorQtyGroup}>
                                <div style={styles.editorQtyBox}>
                                  <span style={styles.editorQtyLabel}>PL Receiving</span>
                                  <strong style={styles.editorQtyValue}>{editorReceivingQty}</strong>
                                </div>
                                <div style={styles.editorQtyBox}>
                                  <span style={styles.editorQtyLabel}>Breakdown Qty</span>
                                  <strong style={styles.editorQtyValue}>{editorBreakdownQty}</strong>
                                </div>
                                <div style={styles.editorQtyBox}>
                                  <span style={styles.editorQtyLabel}>Remaining</span>
                                  <strong style={{ ...styles.editorQtyValue, color: editorRemainingQty < 0 ? '#dc2626' : '#0f172a' }}>{editorRemainingQty}</strong>
                                </div>
                              </div>
                              <div style={styles.editorActionGroup}>
                                <div style={styles.segmentedToggle} role="tablist" aria-label="Size edit section">
                                  <button
                                    type="button"
                                    onClick={() => switchEditSection('breakdown')}
                                    disabled={saving}
                                    style={{
                                      ...styles.segmentedButton,
                                      ...(editSection === 'breakdown' ? styles.segmentedButtonActive : {}),
                                      ...(saving ? styles.disabledButton : {}),
                                    }}
                                  >
                                    Size Breakdown
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => switchEditSection('measurement')}
                                    disabled={saving}
                                    style={{
                                      ...styles.segmentedButton,
                                      ...(editSection === 'measurement' ? styles.segmentedButtonActive : {}),
                                      ...(saving ? styles.disabledButton : {}),
                                    }}
                                  >
                                    Size Chart
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={saveBreakdown}
                                  disabled={saving || !selectedCard}
                                  style={
                                    saving || !selectedCard
                                      ? { ...styles.primaryButton, ...styles.saveButton, ...styles.disabledButton }
                                      : { ...styles.primaryButton, ...styles.saveButton }
                                  }
                                >
                                  {saving ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            </div>
                            <div style={styles.saveFeedback}>
                              {saveFeedbackMessage ? (
                                <p style={{ ...styles.saveFeedbackText, color: saveFeedbackColor }}>{saveFeedbackMessage}</p>
                              ) : null}
                            </div>
                          </>
                        ) : null}
                        {editSection === 'breakdown' ? (
                          <div style={styles.sizeRow}>
                            <div style={styles.sizeHeaderGrid}>
                              <span style={styles.sizeHeaderCell}>Size</span>
                              <span style={styles.sizeHeaderCell}>Qty</span>
                              <span style={styles.sizeHeaderCell}>Checker</span>
                              <span style={styles.sizeHeaderCell}>Action</span>
                            </div>
                            {plRow.sizeRows.map((sizeRow) => (
                              <div key={sizeRow.id} style={styles.sizeInputRow}>
                                <input
                                  data-size-field="size"
                                  data-pl-row-id={plRow.id}
                                  value={sizeRow.size_label}
                                  onChange={(event) => updateSizeRow(plRow.id, sizeRow.id, { size_label: normalizeSizeLabel(event.target.value) })}
                                  onKeyDown={(event) => handleSizeKeyDown(event, plRow.id)}
                                  style={styles.input}
                                  placeholder="S / M / L"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  value={sizeRow.qty}
                                  onChange={(event) => updateSizeRow(plRow.id, sizeRow.id, { qty: event.target.value })}
                                  onKeyDown={(event) => handleSizeKeyDown(event, plRow.id)}
                                  style={styles.input}
                                />
                                <div style={styles.checkerPicker}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const checkerKey = `${plRow.id}:${sizeRow.id}`
                                      setOpenCheckerPickerKey(openCheckerPickerKey === checkerKey ? '' : checkerKey)
                                    }}
                                    style={styles.checkerPickerButton}
                                  >
                                    <span style={styles.checkerSummaryText}>{getCheckerSummary(sizeRow.checker_names)}</span>
                                    <span style={styles.checkerPlusText}>+</span>
                                  </button>
                                  {openCheckerPickerKey === `${plRow.id}:${sizeRow.id}` ? (
                                    <div style={styles.checkerMenu}>
                                      {checkerOptions.length ? (
                                        checkerOptions.map((checkerName) => {
                                          const isActive = normalizeCheckerNames(sizeRow.checker_names).includes(checkerName)
                                          return (
                                            <button
                                              key={`${sizeRow.id}-checker-${checkerName}`}
                                              type="button"
                                              onClick={() => toggleCheckerForSizeRow(plRow.id, sizeRow.id, checkerName)}
                                              style={{
                                                ...styles.checkerOption,
                                                ...(isActive ? styles.checkerOptionActive : {}),
                                              }}
                                            >
                                              <span style={{ ...styles.checkerRadio, ...(isActive ? styles.checkerRadioActive : {}) }} />
                                              {checkerName}
                                            </button>
                                          )
                                        })
                                      ) : (
                                        <span style={styles.emptyText}>No packing staff.</span>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeSizeRow(plRow.id, sizeRow.id)}
                                  disabled={plRow.sizeRows.length <= 1}
                                  style={plRow.sizeRows.length <= 1 ? { ...styles.dangerButton, ...styles.disabledButton } : styles.dangerButton}
                                >
                                  X
                                </button>
                              </div>
                            ))}
                            {(plRow.returnRows || []).map((returnRow) => (
                              <div key={returnRow.id} style={styles.sizeInputRow}>
                                <div style={{ ...styles.readonlyBox, fontWeight: 950 }}>RETURN</div>
                                <input
                                  type="number"
                                  min="0"
                                  value={returnRow.qty}
                                  onChange={(event) => updateReturnRow(plRow.id, returnRow.id, { qty: event.target.value })}
                                  style={styles.input}
                                />
                                <input
                                  value={returnRow.return_reason || ''}
                                  onChange={(event) => updateReturnRow(plRow.id, returnRow.id, { return_reason: event.target.value.toUpperCase() })}
                                  style={styles.input}
                                  placeholder="RETURN REASON"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeReturnRow(plRow.id, returnRow.id)}
                                  style={styles.dangerButton}
                                >
                                  X
                                </button>
                              </div>
                            ))}
                            <div style={styles.buttonRow}>
                              <button type="button" onClick={() => addSizeRow(plRow.id)} style={styles.secondaryButton}>
                                + Add Size
                              </button>
                              <button type="button" onClick={() => addReturnRow(plRow.id)} style={styles.secondaryButton}>
                                + Add PL Returns
                              </button>
                              {isLastPlRow ? (
                                <button type="button" onClick={addPlRow} style={styles.secondaryButton}>
                                  + Add Model Variations
                                </button>
                              ) : null}
                              {hasEditorUnsavedChanges && isLastPlRow ? (
                                <button type="button" onClick={resetCurrentModelRows} style={styles.secondaryButton}>
                                  Reset
                                </button>
                              ) : null}
                              {plRows.length > 1 ? (
                                <button type="button" onClick={() => removePlRow(plRow.id)} style={styles.dangerButton}>
                                  Remove Model
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <div style={styles.measurementPanel}>
                            <div style={styles.sizeChartShortcut}>
                              <label style={styles.filterField}>
                                <span style={styles.filterLabel}>Copy Size Chart</span>
                                <select
                                  value={plRow.sizeChartSourceKey || ''}
                                  onChange={(event) => updatePlRow(plRow.id, { sizeChartSourceKey: event.target.value })}
                                  disabled={!sizeChartOptions.length}
                                  style={!sizeChartOptions.length ? { ...styles.filterSelect, ...styles.disabledButton } : styles.filterSelect}
                                >
                                  <option value="">{sizeChartOptions.length ? 'Choose product size chart' : 'No saved product size chart yet'}</option>
                                  {sizeChartOptions.map((option) => (
                                    <option key={option.key} value={option.key}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button
                                type="button"
                                onClick={() => applySizeChartShortcut(plRow.id)}
                                disabled={!plRow.sizeChartSourceKey || !sizeChartOptions.length}
                                style={!plRow.sizeChartSourceKey || !sizeChartOptions.length ? { ...styles.secondaryButton, ...styles.disabledButton } : styles.secondaryButton}
                              >
                                Apply
                              </button>
                            </div>
                            <div style={styles.measurementHeaderGrid}>
                              <span style={styles.sizeHeaderCell}>Size</span>
                              <span style={styles.sizeHeaderCell}>Qty</span>
                              <span style={styles.sizeHeaderCell}>Weight</span>
                              <span style={styles.sizeHeaderCell}>Length</span>
                              <span style={styles.sizeHeaderCell}>Width</span>
                              <span style={styles.sizeHeaderCell}>Width After Pull</span>
                              <span style={styles.sizeHeaderCell}>Sleeve Length</span>
                              <span style={styles.sizeHeaderCell}>Thigh Width</span>
                            </div>
                            {plRow.sizeRows.map((sizeRow) => (
                              <div key={sizeRow.id} style={styles.measurementInputGrid}>
                                <div style={styles.readonlyBox}>{normalizeSizeLabel(sizeRow.size_label) || 'SIZE'}</div>
                                <div style={styles.readonlyBox}>{Number(sizeRow.qty || 0)}</div>
                                <input value={sizeRow.weight_value} onChange={(event) => updateSizeRow(plRow.id, sizeRow.id, { weight_value: event.target.value })} style={styles.input} />
                                <input value={sizeRow.length_value} onChange={(event) => updateSizeRow(plRow.id, sizeRow.id, { length_value: event.target.value })} style={styles.input} />
                                <input value={sizeRow.width_value} onChange={(event) => updateSizeRow(plRow.id, sizeRow.id, { width_value: event.target.value })} style={styles.input} />
                                <input value={sizeRow.width_afterpull} onChange={(event) => updateSizeRow(plRow.id, sizeRow.id, { width_afterpull: event.target.value })} style={styles.input} />
                                <input value={sizeRow.sleeve_length} onChange={(event) => updateSizeRow(plRow.id, sizeRow.id, { sleeve_length: event.target.value })} style={styles.input} />
                                <input value={sizeRow.thigh_width} onChange={(event) => updateSizeRow(plRow.id, sizeRow.id, { thigh_width: event.target.value })} style={styles.input} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    </fieldset>
                  </div>
                  )
                })}
              </>
            ) : null}
          </div>
        ) : null}
      </section>
      {printModalOpen ? (
        <div style={styles.previewOverlay} onClick={closePrintModal}>
          <div style={styles.printModal} onClick={(event) => event.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <p style={styles.eyebrow}>Print</p>
                <h2 style={styles.modalTitle}>What do you want to print?</h2>
              </div>
              <div style={styles.modalActionGroup}>
                <button type="button" onClick={closePrintModal} style={styles.secondaryButton} disabled={printingPdf}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePrintSubmit}
                  disabled={
                    printingPdf ||
                    (printType === 'packing_list' && (!canPrintPackingListFromView || !hasFilteredPrintData)) ||
                    (printType === 'pl_card' && (!canPrintPlCardFromView || !selectedKoliPrintRows.length))
                  }
                  style={
                    printingPdf ||
                    (printType === 'packing_list' && (!canPrintPackingListFromView || !hasFilteredPrintData)) ||
                    (printType === 'pl_card' && (!canPrintPlCardFromView || !selectedKoliPrintRows.length))
                      ? { ...styles.primaryButton, ...styles.disabledButton }
                      : styles.primaryButton
                  }
                >
                  {printingPdf ? 'Preparing...' : 'Print'}
                </button>
              </div>
            </div>

            <div style={styles.printModalBody}>
              <div style={styles.printChoiceGrid}>
                <button
                  type="button"
                  onClick={() => canPrintPackingListFromView ? setPrintType('packing_list') : null}
                  disabled={!canPrintPackingListFromView}
                  style={{
                    ...styles.printChoiceButton,
                    ...(printType === 'packing_list' ? styles.printChoiceButtonActive : {}),
                    ...(!canPrintPackingListFromView ? styles.disabledButton : {}),
                  }}
                >
                  Packing List
                </button>
                <button
                  type="button"
                  onClick={() => canPrintPlCardFromView ? setPrintType('pl_card') : null}
                  disabled={!canPrintPlCardFromView}
                  style={{
                    ...styles.printChoiceButton,
                    ...(printType === 'pl_card' ? styles.printChoiceButtonActive : {}),
                    ...(!canPrintPlCardFromView ? styles.disabledButton : {}),
                  }}
                >
                  PL Card
                </button>
              </div>

              {printType === 'packing_list' ? (
                <>
                  {pageMode === 'multipage' ? (
                    <div style={styles.segmentedToggle} role="tablist" aria-label="Packing List print range">
                      <button
                        type="button"
                        onClick={() => setPrintRange('all')}
                        style={{
                          ...styles.segmentedButton,
                          ...(printRange === 'all' ? styles.segmentedButtonActive : {}),
                        }}
                      >
                        Print All
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPrintRange('certain')
                          setPrintSectionKey((current) => current || printableSectionOptions[0]?.key || '')
                        }}
                        style={{
                          ...styles.segmentedButton,
                          ...(printRange === 'certain' ? styles.segmentedButtonActive : {}),
                        }}
                      >
                        Print Certain Packing List
                      </button>
                    </div>
                  ) : null}
                  {pageMode === 'multipage' && printRange === 'certain' ? (
                    <label style={styles.field}>
                      <span style={styles.label}>Packing List Page</span>
                      <select
                        value={printSectionKey || printableSectionOptions[0]?.key || ''}
                        onChange={(event) => setPrintSectionKey(event.target.value)}
                        style={styles.input}
                        disabled={!printableSectionOptions.length}
                      >
                        {printableSectionOptions.map((section) => (
                          <option key={section.key} value={section.key}>
                            {section.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {!hasFilteredPrintData ? <p style={styles.errorText}>No Packing List data matches the current filters.</p> : null}
                </>
              ) : (
                <>
                  <p style={styles.emptyText}>
                    {selectedKoliPrintRows.length
                      ? `${selectedKoliPrintRows.length} koli selected for PL Card.`
                      : 'Select at least one koli from the Koli table first.'}
                  </p>
                  {!packingKoliRows.length ? <p style={styles.errorText}>No Koli data matches the current filters.</p> : null}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {allocationModalOpen ? (
        <div style={styles.previewOverlay} onClick={() => closeAllocationModal()}>
          <div style={styles.allocationModal} onClick={(event) => event.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <p style={styles.eyebrow}>Manual</p>
                <div style={styles.modalTitleGroup}>
                  <h2 style={styles.modalTitle}>Allocation</h2>
                  <div style={styles.allocationPresetRow}>
                    <button
                      type="button"
                      onClick={() => applyAllocationPreset('default')}
                      onMouseEnter={() => setAllocationHoveredPreset('default')}
                      onMouseLeave={() => setAllocationHoveredPreset('')}
                      onFocus={() => setAllocationHoveredPreset('default')}
                      onBlur={() => setAllocationHoveredPreset('')}
                      style={{
                        ...styles.allocationPresetButton,
                        ...(allocationHoveredPreset === 'default' ? styles.allocationPresetButtonHover : {}),
                        ...(allocationActivePreset === 'default' ? styles.allocationPresetButtonActive : {}),
                      }}
                    >
                      DEFAULT
                    </button>
                    <button
                      type="button"
                      onClick={() => applyAllocationPreset('mob')}
                      onMouseEnter={() => setAllocationHoveredPreset('mob')}
                      onMouseLeave={() => setAllocationHoveredPreset('')}
                      onFocus={() => setAllocationHoveredPreset('mob')}
                      onBlur={() => setAllocationHoveredPreset('')}
                      style={{
                        ...styles.allocationPresetButton,
                        ...(allocationHoveredPreset === 'mob' ? styles.allocationPresetButtonHover : {}),
                        ...(allocationActivePreset === 'mob' ? styles.allocationPresetButtonActive : {}),
                      }}
                    >
                      ALL MOB
                    </button>
                    <button
                      type="button"
                      onClick={() => applyAllocationPreset('oi')}
                      onMouseEnter={() => setAllocationHoveredPreset('oi')}
                      onMouseLeave={() => setAllocationHoveredPreset('')}
                      onFocus={() => setAllocationHoveredPreset('oi')}
                      onBlur={() => setAllocationHoveredPreset('')}
                      style={{
                        ...styles.allocationPresetButton,
                        ...(allocationHoveredPreset === 'oi' ? styles.allocationPresetButtonHover : {}),
                        ...(allocationActivePreset === 'oi' ? styles.allocationPresetButtonActive : {}),
                      }}
                    >
                      ALL OI
                    </button>
                  </div>
                </div>
              </div>
              <div style={styles.modalActionGroup}>
                <button type="button" onClick={() => closeAllocationModal()} style={styles.secondaryButton}>
                  Cancel
                </button>
                <button type="button" onClick={applyAllocationOverride} style={styles.primaryButton}>
                  Apply
                </button>
              </div>
            </div>

            <div style={styles.allocationModalBody}>
            <div style={styles.allocationTableWrap}>
              <table style={styles.allocationTable}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, ...styles.allocationStickyTh }}>Photo</th>
                    <th style={{ ...styles.th, ...styles.allocationStickyTh }}>PL ID</th>
                    <th style={{ ...styles.th, ...styles.allocationStickyTh, textAlign: 'left' }}>Item</th>
                    <th style={{ ...styles.th, ...styles.allocationStickyTh }}>Size</th>
                    <th style={{ ...styles.th, ...styles.allocationStickyTh }}>Total</th>
                    <th style={{ ...styles.th, ...styles.allocationStickyTh }}>MOB</th>
                    <th style={{ ...styles.th, ...styles.allocationStickyTh }}>OI</th>
                    <th style={{ ...styles.th, ...styles.allocationStickyTh }}>Posted</th>
                  </tr>
                </thead>
                <tbody>
                  {allocationDraftRows.map((row) => (
                    <tr key={row.key}>
                      <td style={styles.allocationTd}>
                        {row.photo_url ? (
                          <button
                            type="button"
                            onClick={() => setPreviewPhoto({ src: row.photo_url, alt: row.pl_name || 'Manual adjustment photo' })}
                            style={styles.allocationPhotoButton}
                            aria-label="Preview photo"
                          >
                            <Image src={row.photo_url} alt={row.pl_name || 'Manual adjustment photo'} width={44} height={44} unoptimized style={styles.allocationPhoto} />
                          </button>
                        ) : (
                          <span style={styles.allocationNoPhoto}>NO</span>
                        )}
                      </td>
                      <td style={styles.allocationTd}>{row.pl_id}</td>
                      <td style={{ ...styles.allocationTd, textAlign: 'left' }}>{row.pl_name || '-'}</td>
                      <td style={styles.allocationTd}>{row.size_label}</td>
                      <td style={styles.allocationTd}>{row.qty}</td>
                      <td style={styles.allocationTd}>
                        <input
                          type="number"
                          min="0"
                          max={row.qty}
                          value={row.mob_qty}
                          onChange={(event) => updateAllocationDraftQty(row.key, 'mob_qty', event.target.value)}
                          style={styles.allocationInput}
                        />
                      </td>
                      <td style={styles.allocationTd}>
                        <input
                          type="number"
                          min="0"
                          max={row.qty}
                          value={row.oi_qty}
                          onChange={(event) => updateAllocationDraftQty(row.key, 'oi_qty', event.target.value)}
                          style={styles.allocationInput}
                        />
                      </td>
                      <td style={styles.allocationTd}>
                        MOB {row.posted_mob_qty} / OI {row.posted_oi_qty}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <label style={styles.field}>
              <span style={styles.label}>Reason</span>
              <textarea
                value={allocationReason}
                onChange={(event) => {
                  setAllocationReason(event.target.value.toUpperCase())
                  setAllocationError('')
                  setAllocationActivePreset('')
                }}
                style={styles.textarea}
                placeholder="REQUIRED FOR MANUAL OVERRIDE"
              />
            </label>

              <div style={styles.modalFeedback}>
                {allocationError ? <p style={styles.errorText}>{allocationError}</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {previewPhoto ? (
        <div style={styles.previewOverlay} onClick={() => setPreviewPhoto(null)}>
          <div style={styles.previewFrame} onClick={(event) => event.stopPropagation()}>
            <Image src={previewPhoto.src} alt={previewPhoto.alt || 'Photo preview'} width={900} height={900} unoptimized style={styles.previewImage} />
            <button type="button" onClick={() => setPreviewPhoto(null)} style={styles.previewClose} aria-label="Close photo preview">
              X
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
