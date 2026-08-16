import { useEffect, useState } from 'react'
import { jsonOptions, request } from '../api'

function normalizeMinutes(value) {
  return value === '' ? null : value
}

function byTitle(first, second) {
  return first.title.localeCompare(second.title)
}

export function useTemplates(endpoint, setError, onCreated, ordered = false) {
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
      setItems((current) => ordered ? [...current, created] : [...current, created].sort(byTitle))
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
      setItems((current) => {
        const changed = current.map((item) => item.id === id ? updated : item)
        return ordered ? changed : changed.sort(byTitle)
      })
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
    const oldItems = items
    const currentIndex = oldItems.findIndex((item) => item.id === id)
    const targetIndex = currentIndex + direction
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= oldItems.length) return
    const reordered = [...oldItems]
    const [moved] = reordered.splice(currentIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    setItems(reordered)
    try {
      await request(`${endpoint}/order`, jsonOptions('PUT', {
        recurring_task_ids: reordered.map((item) => item.id),
      }))
      setError('')
    } catch (error) {
      setItems(oldItems)
      setError(error.message)
    }
  }

  return { items, add, update, remove, move: ordered ? move : null }
}
