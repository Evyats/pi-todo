import { useEffect, useState } from 'react'
import { jsonOptions, request } from '../api'

function normalizeMinutes(value) {
  return value === '' ? null : value
}

function byTitle(first, second) {
  return first.title.localeCompare(second.title)
}

export function useTemplates(endpoint, setError, onCreated) {
  const [items, setItems] = useState([])

  useEffect(() => {
    request(endpoint).then(setItems).catch((error) => setError(error.message))
  }, [endpoint, setError])

  async function add(title, estimatedMinutes) {
    const cleanTitle = title.trim()
    if (!cleanTitle) return false
    try {
      const created = await request(endpoint, jsonOptions('POST', {
        title: cleanTitle,
        estimated_minutes: normalizeMinutes(estimatedMinutes),
      }))
      setItems((current) => [...current, created].sort(byTitle))
      setError('')
      onCreated?.(created)
      return true
    } catch (error) {
      setError(error.message)
      return false
    }
  }

  async function update(id, title, estimatedMinutes) {
    const cleanTitle = title.trim()
    if (!cleanTitle) return false
    try {
      const updated = await request(`${endpoint}/${id}`, jsonOptions('PATCH', {
        title: cleanTitle,
        estimated_minutes: normalizeMinutes(estimatedMinutes),
      }))
      setItems((current) => current
        .map((item) => item.id === id ? updated : item)
        .sort(byTitle))
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

  return { items, add, update, remove }
}
