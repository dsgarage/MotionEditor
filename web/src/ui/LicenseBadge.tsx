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

/** ビューポート右下: アバター名と改変・再配布の可否。改変禁止なら警告色 */
export function LicenseBadge({ license }: Props) {
  const warn = license.modification === 'prohibited'
  return (
    <div className={`${styles.badge} ${warn ? styles.warn : ''}`} role="status">
      <div className={styles.name} title={license.name}>
        {license.name}
        <span className={styles.spec}>VRM {license.specVersion === '0' ? '0.x' : '1.0'}</span>
      </div>
      <dl className={styles.rows}>
        <dt>改変</dt>
        <dd data-state={license.modification}>{LABEL[license.modification]}</dd>
        <dt>再配布</dt>
        <dd data-state={license.redistribution}>{LABEL[license.redistribution]}</dd>
      </dl>
      {license.licenseLabel && (
        <div className={styles.license} title={license.licenseLabel}>
          {license.licenseLabel}
        </div>
      )}
      {warn && <div className={styles.note}>このアバターは改変が禁止されています</div>}
    </div>
  )
}
