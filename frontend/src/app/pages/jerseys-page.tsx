import { Download, ImagePlus, Plus, Shirt, Trash2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/features/auth/api'
import { useSession } from '@/features/auth/session-context'
import { hasAnyRole } from '@/features/auth/types'
import { getPlayerByProfile, listPlayers } from '@/features/players/api'
import type { PlayerRecord } from '@/features/players/types'
import {
  addJerseyDesign,
  addJerseySize,
  cancelJerseyOrder,
  clearJerseyDesignImage,
  createJerseyProject,
  jerseyDesignImageUrl,
  listJerseyDesigns,
  listJerseyOrders,
  listJerseyProjects,
  listJerseySizes,
  saveJerseyDesignImage,
  setJerseyProjectStatus,
  submitJerseyOrder,
} from '@/features/jerseys/api'
import { downloadCsv, ordersToCsv } from '@/features/jerseys/csv'
import { JERSEY_IMAGE_ACCEPT, validateJerseyImage } from '@/features/jerseys/images'
import {
  JERSEY_STAFF_ROLES,
  JERSEY_STATUS_LABELS,
  type JerseyDesignRecord,
  type JerseyOrderRecord,
  type JerseyProjectRecord,
  type JerseyProjectStatus,
  type JerseySizeRecord,
} from '@/features/jerseys/types'
import { formatDateTime } from '@/lib/format'

function formatPrice(value: string | null): string {
  if (value === null) return '—'

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value))
}

function statusTone(status: JerseyProjectStatus): 'accent' | 'warning' | 'neutral' {
  if (status === 'open') return 'accent'
  if (status === 'closed' || status === 'draft') return 'warning'
  return 'neutral'
}

export function JerseysPage() {
  const { user } = useSession()
  const isStaff = hasAnyRole(user?.roles ?? [], JERSEY_STAFF_ROLES)

  const [projects, setProjects] = React.useState<JerseyProjectRecord[]>([])
  const [designs, setDesigns] = React.useState<JerseyDesignRecord[]>([])
  const [sizes, setSizes] = React.useState<JerseySizeRecord[]>([])
  const [orders, setOrders] = React.useState<JerseyOrderRecord[]>([])
  const [players, setPlayers] = React.useState<PlayerRecord[]>([])
  const [ownPlayer, setOwnPlayer] = React.useState<PlayerRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [projectOpen, setProjectOpen] = React.useState(false)
  /** Captured when the data arrives, so deadline checks stay out of render. */
  const [loadedAt, setLoadedAt] = React.useState(0)
  const [assetTarget, setAssetTarget] = React.useState<{
    project: JerseyProjectRecord
    kind: 'design' | 'size'
  } | null>(null)
  const [imageTarget, setImageTarget] = React.useState<JerseyDesignRecord | null>(null)

  React.useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [nextProjects, nextDesigns, nextSizes, nextOrders, nextPlayers] = await Promise.all([
          listJerseyProjects(),
          listJerseyDesigns(),
          listJerseySizes(),
          listJerseyOrders(),
          listPlayers(),
        ])
        const player = user ? await getPlayerByProfile(user.id) : null

        if (!active) return

        setProjects(nextProjects)
        setDesigns(nextDesigns)
        setSizes(nextSizes)
        setOrders(nextOrders)
        setPlayers(nextPlayers)
        setOwnPlayer(player)
        setLoadedAt(Date.now())
      } catch (loadError) {
        if (active) setError(errorMessage(loadError))
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [user, reloadKey])

  const reload = React.useCallback(() => setReloadKey((current) => current + 1), [])

  const playersById = React.useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  )

  async function moveStatus(project: JerseyProjectRecord, status: JerseyProjectStatus) {
    try {
      await setJerseyProjectStatus(project.id, status)
      toast.success(`Project ${JERSEY_STATUS_LABELS[status].toLowerCase()}.`)
      reload()
    } catch (statusError) {
      toast.error(errorMessage(statusError))
    }
  }

  function exportOrders(project: JerseyProjectRecord) {
    const rows = orders
      .filter((order) => order.project_id === project.id && order.status === 'submitted')
      .map((order) => ({
        player: playersById.get(order.player_id)?.full_name ?? 'Unknown player',
        design: designs.find((design) => design.id === order.design_id)?.name ?? '—',
        size: sizes.find((size) => size.id === order.size_id)?.label ?? '—',
        quantity: order.quantity,
      }))

    downloadCsv(
      `${project.name.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}-orders.csv`,
      ordersToCsv(rows),
    )
    toast.success(`Exported ${rows.length} order${rows.length === 1 ? '' : 's'}.`)
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Jerseys" />
        <LoadingState className="mt-6" label="Loading jerseys" rows={5} />
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Jerseys" />
        <ErrorState
          className="mt-6"
          title="Could not load jerseys"
          description={error}
          onRetry={reload}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Jerseys"
        description="Designs, sizes, and the order list. One active order per player and project."
        actions={
          isStaff ? (
            <Button onClick={() => setProjectOpen(true)}>
              <Plus aria-hidden="true" />
              New project
            </Button>
          ) : null
        }
      />

      {projects.length === 0 ? (
        <Card className="mt-5">
          <CardContent className="p-5">
            <EmptyState
              icon={Shirt}
              title="No jersey projects yet"
              description={
                isStaff
                  ? 'Create a project, add designs and sizes, then open it for orders.'
                  : 'Club staff have not opened a jersey project yet.'
              }
              action={
                isStaff ? (
                  <Button onClick={() => setProjectOpen(true)}>
                    <Plus aria-hidden="true" />
                    New project
                  </Button>
                ) : null
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {projects.map((project) => {
            const projectDesigns = designs.filter((design) => design.project_id === project.id)
            const projectSizes = sizes.filter((size) => size.project_id === project.id)
            const projectOrders = orders.filter(
              (order) => order.project_id === project.id && order.status === 'submitted',
            )
            const myOrder = projectOrders.find((order) => order.player_id === ownPlayer?.id)
            const deadlinePassed =
              project.order_deadline !== null &&
              new Date(project.order_deadline).getTime() < loadedAt
            const canOrder = project.status === 'open' && !deadlinePassed

            return (
              <Card key={project.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle>{project.name}</CardTitle>
                    <Badge tone={statusTone(project.status)}>
                      {JERSEY_STATUS_LABELS[project.status]}
                    </Badge>
                  </div>
                  <CardDescription>
                    {project.description ?? 'No description.'} Price {formatPrice(project.price)} ·{' '}
                    {project.order_deadline
                      ? `orders due ${formatDateTime(project.order_deadline)}`
                      : 'no order deadline'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-start gap-2">
                    {projectDesigns.length === 0 ? (
                      <span className="text-xs text-text-faint">No designs yet.</span>
                    ) : (
                      projectDesigns.map((design) => {
                        const image = jerseyDesignImageUrl(design.image_path)

                        return (
                          <div
                            key={design.id}
                            className="flex items-center gap-2 rounded-sm border border-border p-2"
                          >
                            {image ? (
                              <img
                                src={image}
                                alt={`${design.name} mockup`}
                                loading="lazy"
                                className="h-12 w-12 rounded-sm border border-border object-cover"
                              />
                            ) : (
                              <span className="flex h-12 w-12 items-center justify-center rounded-sm border border-border text-center text-[10px] leading-tight text-text-faint">
                                No image
                              </span>
                            )}
                            <div className="flex flex-col items-start gap-1">
                              <span className="text-xs font-medium text-text">{design.name}</span>
                              {isStaff ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setImageTarget(design)}
                                >
                                  <ImagePlus aria-hidden="true" />
                                  {design.image_path ? 'Replace image' : 'Add image'}
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        )
                      })
                    )}
                    {projectSizes.map((size) => (
                      <Badge key={size.id} tone="info">
                        {size.label}
                      </Badge>
                    ))}
                  </div>

                  {isStaff ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setAssetTarget({ project, kind: 'design' })}
                        >
                          <Plus aria-hidden="true" />
                          Design
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setAssetTarget({ project, kind: 'size' })}
                        >
                          <Plus aria-hidden="true" />
                          Size
                        </Button>
                        {project.status === 'draft' ? (
                          <Button size="sm" onClick={() => void moveStatus(project, 'open')}>
                            Open orders
                          </Button>
                        ) : null}
                        {project.status === 'open' ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void moveStatus(project, 'closed')}
                          >
                            Close orders
                          </Button>
                        ) : null}
                        {project.status === 'closed' ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void moveStatus(project, 'completed')}
                          >
                            Mark completed
                          </Button>
                        ) : null}
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h3 className="text-xs font-medium uppercase tracking-[0.06em] text-text-faint">
                            Orders ({projectOrders.length})
                          </h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={projectOrders.length === 0}
                            onClick={() => exportOrders(project)}
                          >
                            <Download aria-hidden="true" />
                            Export CSV
                          </Button>
                        </div>

                        {projectOrders.length === 0 ? (
                          <p className="text-sm text-text-muted">No orders yet.</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Player</TableHead>
                                <TableHead>Design</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {projectOrders.map((order) => (
                                <TableRow key={order.id}>
                                  <TableCell className="text-text">
                                    {playersById.get(order.player_id)?.full_name ?? 'Unknown'}
                                  </TableCell>
                                  <TableCell className="text-text-muted">
                                    {designs.find((design) => design.id === order.design_id)
                                      ?.name ?? '—'}
                                  </TableCell>
                                  <TableCell className="text-text-muted">
                                    {sizes.find((size) => size.id === order.size_id)?.label ?? '—'}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {order.quantity}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-3 rounded-sm border border-border p-3">
                      {myOrder ? (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm text-text">
                            Your order:{' '}
                            {projectDesigns.find((d) => d.id === myOrder.design_id)?.name ?? '—'} ·{' '}
                            {projectSizes.find((s) => s.id === myOrder.size_id)?.label ?? '—'} · qty{' '}
                            {myOrder.quantity}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void cancelOrder(myOrder.id)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-text-muted">You have not ordered yet.</p>
                      )}

                      {canOrder ? (
                        <OrderForm
                          project={project}
                          designs={projectDesigns}
                          sizes={projectSizes}
                          existing={myOrder}
                          onSaved={reload}
                        />
                      ) : (
                        <p className="text-xs text-text-muted">
                          {deadlinePassed
                            ? 'The order deadline has passed.'
                            : 'Orders are not open for this project.'}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {projectOpen ? (
        <ProjectFormDialog
          open
          onOpenChange={setProjectOpen}
          onCreated={() => {
            setProjectOpen(false)
            reload()
          }}
        />
      ) : null}

      {assetTarget ? (
        <AssetDialog
          project={assetTarget.project}
          kind={assetTarget.kind}
          onOpenChange={() => setAssetTarget(null)}
          onSaved={() => {
            setAssetTarget(null)
            reload()
          }}
        />
      ) : null}

      {imageTarget ? (
        <DesignImageDialog
          design={imageTarget}
          onOpenChange={() => setImageTarget(null)}
          onSaved={() => {
            setImageTarget(null)
            reload()
          }}
        />
      ) : null}
    </>
  )

  async function cancelOrder(orderId: string) {
    try {
      await cancelJerseyOrder(orderId)
      toast.success('Order cancelled. You can order again before the deadline.')
      reload()
    } catch (cancelError) {
      toast.error(errorMessage(cancelError))
    }
  }
}

function OrderForm({
  project,
  designs,
  sizes,
  existing,
  onSaved,
}: {
  project: JerseyProjectRecord
  designs: readonly JerseyDesignRecord[]
  sizes: readonly JerseySizeRecord[]
  existing: JerseyOrderRecord | undefined
  onSaved: () => void
}) {
  const [designId, setDesignId] = React.useState(existing?.design_id ?? '')
  const [sizeId, setSizeId] = React.useState(existing?.size_id ?? '')
  const [quantity, setQuantity] = React.useState(String(existing?.quantity ?? 1))
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const qty = Number(quantity)

    if (!designId || !sizeId) {
      setError('Choose a design and a size.')
      return
    }

    if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
      setError('Quantity must be a whole number between 1 and 20.')
      return
    }

    setSaving(true)

    try {
      await submitJerseyOrder({
        project_id: project.id,
        design_id: designId,
        size_id: sizeId,
        quantity: qty,
      })
      toast.success(existing ? 'Order updated.' : 'Order submitted.')
      onSaved()
    } catch (submitError) {
      setError(errorMessage(submitError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_6rem]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`design-${project.id}`}>Design</Label>
          <Select value={designId} onValueChange={setDesignId}>
            <SelectTrigger id={`design-${project.id}`}>
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {designs.map((design) => (
                <SelectItem key={design.id} value={design.id}>
                  {design.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`size-${project.id}`}>Size</Label>
          <Select value={sizeId} onValueChange={setSizeId}>
            <SelectTrigger id={`size-${project.id}`}>
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {sizes.map((size) => (
                <SelectItem key={size.id} value={size.id}>
                  {size.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`qty-${project.id}`}>Quantity</Label>
          <Input
            id={`qty-${project.id}`}
            type="number"
            min={1}
            max={20}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </div>
      </div>

      <Button type="submit" size="sm" className="self-start" loading={saving}>
        {existing ? 'Update order' : 'Submit order'}
      </Button>
    </form>
  )
}

function ProjectFormDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [price, setPrice] = React.useState('')
  const [deadline, setDeadline] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (name.trim() === '') {
      setError('Enter a project name.')
      return
    }

    const priceValue = price.trim() === '' ? null : Number(price)

    if (priceValue !== null && (!Number.isFinite(priceValue) || priceValue < 0)) {
      setError('Price must be zero or more.')
      return
    }

    setSubmitting(true)

    try {
      await createJerseyProject({
        name: name.trim(),
        description: description.trim() === '' ? null : description.trim(),
        price: priceValue,
        order_deadline: deadline === '' ? null : new Date(deadline).toISOString(),
      })
      toast.success('Project created as a draft. Add designs and sizes, then open it.')
      onCreated()
    } catch (createError) {
      setError(errorMessage(createError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New jersey project</DialogTitle>
          <DialogDescription>
            It starts as a draft. Designs and sizes are added before it can accept orders.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void submit(event)} noValidate>
          <div className="mt-5 flex flex-col gap-4">
            {error ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={description}
                maxLength={2000}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="project-price">Price (PHP)</Label>
                <Input
                  id="project-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="project-deadline">Order deadline</Label>
                <Input
                  id="project-deadline"
                  type="datetime-local"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AssetDialog({
  project,
  kind,
  onOpenChange,
  onSaved,
}: {
  project: JerseyProjectRecord
  kind: 'design' | 'size'
  onOpenChange: () => void
  onSaved: () => void
}) {
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [file, setFile] = React.useState<File | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function save() {
    setError(null)

    if (name.trim() === '') {
      setError(kind === 'design' ? 'Enter a design name.' : 'Enter a size label.')
      return
    }

    if (kind === 'design' && file) {
      const problem = validateJerseyImage(file)

      if (problem) {
        setError(problem)
        return
      }
    }

    setSubmitting(true)

    try {
      if (kind === 'design') {
        const design = await addJerseyDesign(
          project.id,
          name.trim(),
          description.trim() === '' ? null : description.trim(),
        )

        if (file) {
          await saveJerseyDesignImage({
            projectId: project.id,
            designId: design.id,
            file,
            previousPath: null,
          })
        }
      } else {
        await addJerseySize(project.id, name.trim())
      }

      toast.success(kind === 'design' ? 'Design added.' : 'Size added.')
      onSaved()
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === 'design' ? 'Add a design' : 'Add a size'}</DialogTitle>
          <DialogDescription>{project.name}</DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-3">
          {error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="asset-name">{kind === 'design' ? 'Design name' : 'Size label'}</Label>
            <Input
              id="asset-name"
              value={name}
              maxLength={kind === 'design' ? 120 : 20}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          {kind === 'design' ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="asset-description">Description</Label>
              <Textarea
                id="asset-description"
                value={description}
                maxLength={2000}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          ) : null}

          {kind === 'design' ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="asset-image">Mockup image (optional)</Label>
              <Input
                id="asset-image"
                type="file"
                accept={JERSEY_IMAGE_ACCEPT}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-text-faint">PNG, JPEG, or WebP up to 5 MB.</p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onOpenChange} disabled={submitting}>
            Cancel
          </Button>
          <Button loading={submitting} onClick={() => void save()}>
            Add {kind}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DesignImageDialog({
  design,
  onOpenChange,
  onSaved,
}: {
  design: JerseyDesignRecord
  onOpenChange: () => void
  onSaved: () => void
}) {
  const [file, setFile] = React.useState<File | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [removing, setRemoving] = React.useState(false)

  async function save() {
    setError(null)

    if (!file) {
      setError('Choose an image file.')
      return
    }

    const problem = validateJerseyImage(file)

    if (problem) {
      setError(problem)
      return
    }

    setSaving(true)

    try {
      await saveJerseyDesignImage({
        projectId: design.project_id,
        designId: design.id,
        file,
        previousPath: design.image_path,
      })
      toast.success(design.image_path ? 'Design image replaced.' : 'Design image added.')
      onSaved()
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setError(null)
    setRemoving(true)

    try {
      await clearJerseyDesignImage(design.id, design.image_path)
      toast.success('Design image removed.')
      onSaved()
    } catch (removeError) {
      setError(errorMessage(removeError))
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {design.image_path ? 'Replace design image' : 'Add design image'}
          </DialogTitle>
          <DialogDescription>
            {design.name} · PNG, JPEG, or WebP up to 5 MB. Members see the mockup on the project.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-3">
          {error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="design-image">Image file</Label>
            <Input
              id="design-image"
              type="file"
              accept={JERSEY_IMAGE_ACCEPT}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>

          {design.image_path ? (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              loading={removing}
              onClick={() => void remove()}
            >
              <Trash2 aria-hidden="true" />
              Remove current image
            </Button>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onOpenChange} disabled={saving || removing}>
            Cancel
          </Button>
          <Button loading={saving} onClick={() => void save()}>
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
