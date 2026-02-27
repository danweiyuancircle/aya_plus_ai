import { observer } from 'mobx-react-lite'
import { useState, useEffect, useRef } from 'react'
import { t } from 'common/util'
import Style from './StatusBar.module.scss'
import store from '../../store'

interface IDeviceInfo {
  model: string
  ip: string
  androidVersion: string
}

export default observer(function StatusBar() {
  const [activity, setActivity] = useState({ packageName: '', activityName: '' })
  const [deviceInfo, setDeviceInfo] = useState<IDeviceInfo | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  const device = store.device

  useEffect(() => {
    setDeviceInfo(null)
    setActivity({ packageName: '', activityName: '' })

    if (!device) return

    main.getOverview(device.id).then((overview: any) => {
      setDeviceInfo({
        model: overview.model || '',
        ip: overview.ip || '',
        androidVersion: device.androidVersion || '',
      })
    })
  }, [device])

  useEffect(() => {
    if (!device) return

    async function fetchActivity() {
      try {
        const result = await main.getTopActivity(device!.id)
        setActivity(result)
      } catch {
        // ignore
      }
    }

    fetchActivity()
    timerRef.current = setInterval(fetchActivity, 3000)

    return () => {
      clearInterval(timerRef.current)
    }
  }, [device])

  if (!device) return null

  const activityText = activity.packageName
    ? activity.activityName
      ? `${activity.packageName}/${activity.activityName}`
      : activity.packageName
    : '-'

  return (
    <div className={Style.container}>
      <div className={Style.left}>
        <span className={Style.item} title={activityText}>
          <span className="icon-android" />
          <span className={Style.text}>{activityText}</span>
        </span>
      </div>
      {deviceInfo && (
        <div className={Style.right}>
          {deviceInfo.model && (
            <span className={Style.item}>
              <span className="icon-phone" />
              {deviceInfo.model}
            </span>
          )}
          {deviceInfo.ip && (
            <span className={Style.item}>
              <span className="icon-wifi" />
              {deviceInfo.ip}
            </span>
          )}
          {deviceInfo.androidVersion && (
            <span className={Style.item}>
              {t('androidVersion')} {deviceInfo.androidVersion}
            </span>
          )}
        </div>
      )}
    </div>
  )
})
