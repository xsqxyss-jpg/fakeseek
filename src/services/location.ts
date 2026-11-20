import { cityNames, regionCodes, regionNameOverrides, provinceNames } from './locationData.js'

export { regionCodes } from './locationData.js'

export const provinces = Object.entries(provinceNames).map(([code, name]) => ({
  code,
  name,
  cities: Object.entries(cityNames)
    .filter(([city]) => city.startsWith(code.slice(0, 2)))
    .map(([code, name]) => ({ code, name })),
}))

export type UserLocation = {
  region: string
  province?: string
  city?: string
}

const regions = new Set(regionCodes)

let displayNamesMap: Record<'zh-CN' | 'en-US', Intl.DisplayNames | null | undefined> = {
  'zh-CN': undefined,
  'en-US': undefined,
}

const getDisplayNameInstance = (locale: 'zh-CN' | 'en-US'): Intl.DisplayNames | null => {
  if (displayNamesMap[locale] === undefined) {
    try {
      if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
        displayNamesMap[locale] = new Intl.DisplayNames([locale], { type: 'region' })
      } else {
        displayNamesMap[locale] = null
      }
    } catch {
      displayNamesMap[locale] = null
    }
  }
  return displayNamesMap[locale] ?? null
}

export const getRegionName = (code: string, locale: 'zh-CN' | 'en-US'): string => {
  if (!regions.has(code)) {
    return ''
  }
  const override = regionNameOverrides[locale]?.[code]
  if (override) {
    return override
  }
  try {
    const dn = getDisplayNameInstance(locale)
    const name = dn?.of(code)
    if (name) {
      return name
    }
  } catch {
    // 降级直接返回 code，绝不向外抛异常
  }
  return code
}

export const normalizeLocation = (value: unknown): UserLocation | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const location = value as Record<string, unknown>
  const { region, province, city } = location
  if (typeof region !== 'string' || !regions.has(region)) {
    return null
  }
  if (region !== 'CN') {
    return { region }
  }
  if (province === undefined) {
    return city === undefined ? { region } : null
  }
  const selectedProvince = provinces.find((item) => item.code === province)
  if (!selectedProvince) {
    return null
  }
  if (city === undefined) {
    return { region, province: selectedProvince.code }
  }
  const selectedCity = selectedProvince.cities.find((item) => item.code === city)
  return selectedCity ? { region, province: selectedProvince.code, city: selectedCity.code } : null
}
