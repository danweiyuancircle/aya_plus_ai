import types from 'licia/types'
import uniqId from 'licia/uniqId'
import { Client } from '@devicefarmer/adbkit'
import { handleEvent } from 'share/main/lib/util'
import * as window from 'share/main/lib/window'
import {
  IpcStartCapture,
  IpcStopCapture,
  IpcExportCapture,
} from 'common/types'
import fs from 'fs-extra'
import { shell } from './base'

let client: Client

const CAPTURE_DIR = '/data/local/tmp'

interface CaptureInfo {
  deviceId: string
  remotePath: string
  packetCount: number
  size: number
  running: boolean
  timer: ReturnType<typeof setInterval> | null
}

const captures: types.PlainObj<CaptureInfo> = {}

async function pollStats(captureId: string) {
  const info = captures[captureId]
  if (!info || !info.running) return

  try {
    const result = await shell(info.deviceId, `ls -l ${info.remotePath}`)
    const parts = result.trim().split(/\s+/)
    const size = parseInt(parts[4], 10)
    if (!isNaN(size) && size > 24) {
      info.size = size - 24
      info.packetCount++
      window.sendTo('main', 'captureData', captureId, {
        packetCount: info.packetCount,
        size: info.size,
      })
    }
  } catch {
    // ignore
  }
}

const startCapture: IpcStartCapture = async function (deviceId, filter) {
  const captureId = uniqId('capture')
  const remotePath = `${CAPTURE_DIR}/aya_capture_${captureId}.pcap`

  let cmd = `tcpdump -i any -p -s 0 -w ${remotePath}`
  if (filter) {
    cmd += ` ${filter}`
  }
  // Run tcpdump in background on device
  shell(deviceId, `${cmd} &`).catch(() => {})

  const info: CaptureInfo = {
    deviceId,
    remotePath,
    packetCount: 0,
    size: 0,
    running: true,
    timer: null,
  }
  captures[captureId] = info

  info.timer = setInterval(() => pollStats(captureId), 1000)

  return captureId
}

const stopCapture: IpcStopCapture = async function (captureId, cleanup) {
  const info = captures[captureId]
  if (!info) return

  if (info.running) {
    info.running = false
    if (info.timer) {
      clearInterval(info.timer)
      info.timer = null
    }
    try {
      await shell(info.deviceId, 'pkill -f "tcpdump.*aya_capture"')
    } catch {
      // ignore
    }
    // Poll once more to get final stats
    await pollStats(captureId)
    window.sendTo('main', 'captureEnd', captureId)
  }

  if (cleanup) {
    try {
      await shell(info.deviceId, `rm -f ${info.remotePath}`)
    } catch {
      // ignore
    }
    delete captures[captureId]
  }
}

const exportCapture: IpcExportCapture = async function (captureId, filePath) {
  const info = captures[captureId]
  if (!info) return

  const device = await client.getDevice(info.deviceId)
  const transfer = await device.pull(info.remotePath)

  await new Promise<void>((resolve, reject) => {
    const writeStream = fs.createWriteStream(filePath)
    transfer.on('error', reject)
    writeStream.on('error', reject)
    writeStream.on('finish', resolve)
    transfer.pipe(writeStream)
  })

  // Clean up remote file
  try {
    await shell(info.deviceId, `rm -f ${info.remotePath}`)
  } catch {
    // ignore
  }
  delete captures[captureId]
}

export function init(c: Client) {
  client = c

  handleEvent('startCapture', startCapture)
  handleEvent('stopCapture', stopCapture)
  handleEvent('exportCapture', exportCapture)
}
