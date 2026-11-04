// The free plan's daily D1 limits are shared by the whole Cloudflare account and reset at midnight UTC.
export const isD1Outage = (error: unknown) => /D1_ERROR/.test(String(error)) && /limit|exceeded/i.test(String(error))

export const resetsAt = (now = new Date()) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toLocaleString("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Shanghai",
  })
