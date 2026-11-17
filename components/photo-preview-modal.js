'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './photo-preview-modal.module.css'

export default function PhotoPreviewModal({ src, alt = 'Photo preview', onClose }) {
  if (!src) return null
  return <PhotoPreviewContent key={src} src={src} alt={alt} onClose={onClose} />
}

function PhotoPreviewContent({ src, alt, onClose }) {
  const viewerRef = useRef(null)
  const closeRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [naturalSize, setNaturalSize] = useState({ width: 900, height: 900 })
  const [viewerSize, setViewerSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!src) return undefined

    const previousOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousFocus = document.activeElement
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    closeRef.current?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
      previousFocus?.focus?.()
    }
  }, [onClose, src])

  useEffect(() => {
    if (!src) return undefined
    const viewer = viewerRef.current
    if (!viewer) return undefined

    function updateViewerSize() {
      setViewerSize({ width: viewer.clientWidth, height: viewer.clientHeight })
    }

    updateViewerSize()
    const observer = new ResizeObserver(updateViewerSize)
    observer.observe(viewer)
    return () => observer.disconnect()
  }, [src])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    viewer.scrollLeft = (viewer.scrollWidth - viewer.clientWidth) / 2
    viewer.scrollTop = (viewer.scrollHeight - viewer.clientHeight) / 2
  }, [naturalSize, zoom, viewerSize])

  if (typeof document === 'undefined') return null

  const availableWidth = Math.max(1, viewerSize.width - 32)
  const availableHeight = Math.max(1, viewerSize.height - 32)
  const fitScale = Math.min(availableWidth / naturalSize.width, availableHeight / naturalSize.height)
  const imageWidth = Math.round(naturalSize.width * fitScale * zoom)
  const imageHeight = Math.round(naturalSize.height * fitScale * zoom)

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={alt}>
      <div className={styles.toolbar}>
        <div className={styles.zoomControls} aria-label="Photo zoom controls">
          <button type="button" onClick={() => setZoom((value) => Math.max(1, value - 0.5))} disabled={zoom === 1} aria-label="Zoom out">-</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((value) => Math.min(3, value + 0.5))} disabled={zoom === 3} aria-label="Zoom in">+</button>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} className={styles.close} aria-label="Close photo preview">X</button>
      </div>
      <div ref={viewerRef} className={styles.viewer}>
        <div className={styles.canvas}>
          <Image
            src={src}
            alt={alt}
            width={900}
            height={900}
            unoptimized
            className={styles.image}
            style={{ width: imageWidth, height: imageHeight, visibility: viewerSize.width ? 'visible' : 'hidden' }}
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget
              if (naturalWidth && naturalHeight) setNaturalSize({ width: naturalWidth, height: naturalHeight })
            }}
          />
        </div>
      </div>
    </div>,
    document.body
  )
}
