import { useEffect, useState } from 'react'
import { jsonOptions, request } from '../api'

export function remainingNoticeDays(expiresOn, today) {
  const toUtc = (value) => {
    const [year, month, day] = value.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return Math.max(0, Math.round((toUtc(expiresOn) - toUtc(today)) / 86_400_000) + 1)
}

export function useNotices(endpoint, setError, currentDate) {
  const [items, setItems] = useState([])

  useEffect(() => {
    request(endpoint).then(setItems).catch((error) => setError(error.message))
  }, [endpoint, setError, currentDate])

  async function add(title, durationDays) {
    const cleanTitle = title.trim()
    if (!cleanTitle) return false
    try {
      const created = await request(endpoint, jsonOptions('POST', {
        title: cleanTitle,
        duration_days: durationDays,
      }))
      setItems((current) => [...current, created])
      setError('')
      return true
    } catch (error) {
      setError(error.message)
      return false
    }
  }

  async function update(id, title, durationDays) {
    const cleanTitle = title.trim()
    if (!cleanTitle) return false
    try {
      const updated = await request(`${endpoint}/${id}`, jsonOptions('PATCH', {
        title: cleanTitle,
        duration_days: durationDays,
      }))
      setItems((current) => current.map((item) => item.id === id ? updated : item))
      setError('')
      return true
    } catch (error) {
      setError(error.message)
      return false
    }
  }

  async function remove(id) {
    try {
      await request(`${endpoint}/${id}`, { method: 'DELETE' })
      setItems((current) => current.filter((item) => item.id !== id))
      setError('')
    } catch (error) {
      setError(error.message)
    }
  }

  async function move(id, direction) {
    const previous = items
    const currentIndex = previous.findIndex((item) => item.id === id)
    const targetIndex = currentIndex + direction
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= previous.length) return
    const reordered = [...previous]
    const [moved] = reordered.splice(currentIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    setItems(reordered)
    try {
      await request(`${endpoint}/order`, jsonOptions('PUT', {
        notice_ids: reordered.map((item) => item.id),
      }))
      setError('')
    } catch (error) {
      setItems(previous)
      setError(error.message)
    }
  }

  return { items, add, update, remove, move }
}
