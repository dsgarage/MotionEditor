import type { AvatarLicense, Permission } from '../avatar/license'
import styles from './LicenseBadge.module.css'

const LABEL: Record<Permission, string> = {
  allowed: '可',
  prohibited: '不可',
  unknown: '不明',
}

interface Props {
  license: AvatarLicense
}

/** ステージ左下: アバター名と改変・再配布の可否。改変禁止なら警告色 */
export function LicenseBadge({ license }: Props) {
  const warn = license.modification === 'prohibited'
  const spec = `VRM ${license.specVersion === '0' ? '0.x' : '1.0'}`
  const tip = [license.name, spec, license.licenseLabel].filter(Boolean).join('\n')
  return (
    <div className={`${styles.badge} ${warn ? styles.warn : ''}`} role="status" title={tip}>
      <div className={styles.name}>{license.name}</div>
      <div className={styles.rows}>
        <span data-state={license.modification}>改変{LABEL[license.modification]}</span>
        <span data-state={license.redistribution}>再配布{LABEL[license.redistribution]}</span>
        <span className={`mono ${styles.spec}`}>{spec}</span>
      </div>
      {license.licenseLabel && <div className={`mono ${styles.license}`}>{license.licenseLabel}</div>}
      {warn && <div className={styles.note}>このアバターは改変が禁止されています</div>}
    </div>
  )
}
