import { useEffect, useState } from 'react'
import { jsonOptions, request } from '../api'

export function useRemoteCollection({
  endpoint,
  setError,
  reloadKey = null,
  sortItems = (items) => items,
  createBody,
  updateBody,
  orderBody = null,
  onCreated = null,
}) {
  const [items, setItems] = useState([])

  useEffect(() => {
    request(endpoint)
      .then(setItems)
      .catch((error) => setError(error.message))
  }, [endpoint, reloadKey, setError])

  async function add(...values) {
    const body = createBody(...values)
    if (!body) return false
    try {
      const created = await request(endpoint, jsonOptions('POST', body))
      setItems((current) => sortItems([...current, created]))
      setError('')
      onCreated?.(created)
      return true
    } catch (error) {
      setError(error.message)
      return false
    }
  }

  async function update(id, ...values) {
    const body = updateBody(...values)
    if (!body) return false
    try {
      const updated = await request(`${endpoint}/${id}`, jsonOptions('PATCH', body))
      setItems((current) => sortItems(
        current.map((item) => item.id === id ? updated : item),
      ))
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
    if (!orderBody) return
    const previous = items
    const currentIndex = previous.findIndex((item) => item.id === id)
    const targetIndex = currentIndex + direction
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= previous.length) return
    const reordered = [...previous]
    const [moved] = reordered.splice(currentIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    setItems(reordered)
    try {
      await request(`${endpoint}/order`, jsonOptions('PUT', orderBody(reordered)))
      setError('')
    } catch (error) {
      setItems(previous)
      setError(error.message)
    }
  }

  return { items, add, update, remove, move: orderBody ? move : null }
}
