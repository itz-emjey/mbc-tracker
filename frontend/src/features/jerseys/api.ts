import { errorMessage } from '@/features/auth/api'
import { getSupabaseClient } from '@/lib/supabase'

import { buildJerseyImagePath, JERSEY_IMAGE_BUCKET, validateJerseyImage } from './images'

import type {
  JerseyDesignRecord,
  JerseyOrderRecord,
  JerseyProjectRecord,
  JerseyProjectStatus,
  JerseySizeRecord,
} from './types'

const PROJECT_COLUMNS = 'id, name, description, price, order_deadline, status, created_at'
const DESIGN_COLUMNS = 'id, project_id, name, description, image_path, position'
const SIZE_COLUMNS = 'id, project_id, label, position'
const ORDER_COLUMNS = 'id, project_id, player_id, design_id, size_id, quantity, status, created_at'

export async function listJerseyProjects(): Promise<JerseyProjectRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('jersey_projects')
    .select(PROJECT_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as JerseyProjectRecord[]
}

export async function listJerseyDesigns(): Promise<JerseyDesignRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('jersey_designs')
    .select(DESIGN_COLUMNS)
    .order('position', { ascending: true })

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as JerseyDesignRecord[]
}

export async function listJerseySizes(): Promise<JerseySizeRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('jersey_sizes')
    .select(SIZE_COLUMNS)
    .order('position', { ascending: true })

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as JerseySizeRecord[]
}

export async function listJerseyOrders(): Promise<JerseyOrderRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('jersey_orders')
    .select(ORDER_COLUMNS)
    .order('created_at', { ascending: true })

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as JerseyOrderRecord[]
}

export async function createJerseyProject(input: {
  name: string
  description: string | null
  price: number | null
  order_deadline: string | null
}): Promise<{ id: string }> {
  const { data, error } = await getSupabaseClient().rpc('create_jersey_project', {
    p_name: input.name,
    p_description: input.description,
    p_price: input.price,
    p_order_deadline: input.order_deadline,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as { id: string }
}

export async function setJerseyProjectStatus(
  projectId: string,
  status: JerseyProjectStatus,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc('set_jersey_project_status', {
    p_project_id: projectId,
    p_status: status,
  })

  if (error) throw new Error(errorMessage(error))
}

export async function addJerseyDesign(
  projectId: string,
  name: string,
  description: string | null,
): Promise<{ id: string }> {
  const { data, error } = await getSupabaseClient().rpc('add_jersey_design', {
    p_project_id: projectId,
    p_name: name,
    p_description: description,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as { id: string }
}

export async function addJerseySize(projectId: string, label: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('add_jersey_size', {
    p_project_id: projectId,
    p_label: label,
  })

  if (error) throw new Error(errorMessage(error))
}

export async function submitJerseyOrder(input: {
  project_id: string
  design_id: string
  size_id: string
  quantity: number
}): Promise<void> {
  const { error } = await getSupabaseClient().rpc('submit_jersey_order', {
    p_project_id: input.project_id,
    p_design_id: input.design_id,
    p_size_id: input.size_id,
    p_quantity: input.quantity,
  })

  if (error) throw new Error(errorMessage(error))
}

export async function cancelJerseyOrder(orderId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('cancel_jersey_order', {
    p_order_id: orderId,
  })

  if (error) throw new Error(errorMessage(error))
}

async function uploadJerseyDesignImage(projectId: string, file: File): Promise<string> {
  const problem = validateJerseyImage(file)

  if (problem) throw new Error(problem)

  const path = buildJerseyImagePath(projectId, crypto.randomUUID(), file.type)
  const { error } = await getSupabaseClient()
    .storage.from(JERSEY_IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) throw new Error(errorMessage(error))

  return path
}

async function attachJerseyDesignImage(designId: string, path: string | null): Promise<void> {
  const { error } = await getSupabaseClient().rpc('set_jersey_design_image', {
    p_design_id: designId,
    p_image_path: path,
  })

  if (error) throw new Error(errorMessage(error))
}

async function removeJerseyDesignImage(path: string): Promise<void> {
  const { error } = await getSupabaseClient().storage.from(JERSEY_IMAGE_BUCKET).remove([path])

  if (error) throw new Error(errorMessage(error))
}

/**
 * Uploads the mockup, points the design at it, then deletes the replaced
 * object. A failed attach removes the orphan upload; a failed cleanup of the
 * old object never fails the save, because the new image is already live.
 */
export async function saveJerseyDesignImage(input: {
  projectId: string
  designId: string
  file: File
  previousPath: string | null
}): Promise<void> {
  const path = await uploadJerseyDesignImage(input.projectId, input.file)

  try {
    await attachJerseyDesignImage(input.designId, path)
  } catch (attachError) {
    await removeJerseyDesignImage(path).catch(() => undefined)
    throw attachError
  }

  if (input.previousPath) {
    await removeJerseyDesignImage(input.previousPath).catch(() => undefined)
  }
}

/** Clears the pointer first, so a failed delete cannot leave a broken image. */
export async function clearJerseyDesignImage(
  designId: string,
  previousPath: string | null,
): Promise<void> {
  await attachJerseyDesignImage(designId, null)

  if (previousPath) {
    await removeJerseyDesignImage(previousPath).catch(() => undefined)
  }
}

/** Public bucket URL, or `null` when the design has no mockup. */
export function jerseyDesignImageUrl(path: string | null): string | null {
  if (!path) return null

  return getSupabaseClient().storage.from(JERSEY_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
}
