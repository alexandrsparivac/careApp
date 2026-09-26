import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/api'
import type { Elder } from '../lib/types'
import { useI18n } from '../i18n'
import { Button, ErrorNote, Field, Input, Modal, Select, Textarea } from './ui'

type Form = Omit<Elder, 'id' | 'created_at'>
const EMPTY: Form = {
  full_name: '',
  birth_date: null,
  gender: null,
  address: null,
  medical_conditions: null,
  allergies: null,
  medications: null,
  mobility_notes: null,
  emergency_contact_name: null,
  emergency_contact_phone: null,
}

export function ElderFormModal({ open, onClose, onSaved, elder }: { open: boolean; onClose: () => void; onSaved: (id: string) => void; elder?: Elder | null }) {
  const { t } = useI18n()
  const [form, setForm] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setForm(elder ? (Object.fromEntries(Object.keys(EMPTY).map((k) => [k, elder[k as keyof Form]])) as Form) : EMPTY)
  }, [open, elder])

  const set = <K extends keyof Form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v === '' ? null : v }))
  const val = (v: string | null) => v ?? ''

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = { ...form, full_name: form.full_name.trim() }
    const res = elder ? await supabase.from('elders').update(payload).eq('id', elder.id).select('id').single() : await supabase.from('elders').insert(payload).select('id').single()
    setSaving(false)
    if (res.error) return setError(errorMessage(res.error))
    onSaved(res.data.id)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={elder ? t('elders.edit') : t('elders.add')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="elder-form" loading={saving}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="elder-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label={t('elders.fullName')} className="sm:col-span-2">
          {(id) => <Input id={id} required minLength={2} maxLength={120} value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />}
        </Field>
        <Field label={t('elders.birthDate')}>{(id) => <Input id={id} type="date" value={val(form.birth_date)} onChange={(e) => set('birth_date', e.target.value)} />}</Field>
        <Field label={t('elders.gender')}>
          {(id) => (
            <Select id={id} value={val(form.gender)} onChange={(e) => set('gender', e.target.value)}>
              <option value="">—</option>
              <option value="female">{t('gender.female')}</option>
              <option value="male">{t('gender.male')}</option>
              <option value="other">{t('gender.other')}</option>
            </Select>
          )}
        </Field>
        <Field label={t('elders.address')} className="sm:col-span-2">
          {(id) => <Input id={id} value={val(form.address)} onChange={(e) => set('address', e.target.value)} />}
        </Field>
        <Field label={t('elders.medicalConditions')} className="sm:col-span-2">
          {(id) => <Textarea id={id} rows={2} value={val(form.medical_conditions)} onChange={(e) => set('medical_conditions', e.target.value)} />}
        </Field>
        <Field label={t('elders.medications')}>{(id) => <Textarea id={id} rows={2} value={val(form.medications)} onChange={(e) => set('medications', e.target.value)} />}</Field>
        <Field label={t('elders.allergies')}>{(id) => <Textarea id={id} rows={2} value={val(form.allergies)} onChange={(e) => set('allergies', e.target.value)} />}</Field>
        <Field label={t('elders.mobilityNotes')} className="sm:col-span-2">
          {(id) => <Textarea id={id} rows={2} value={val(form.mobility_notes)} onChange={(e) => set('mobility_notes', e.target.value)} />}
        </Field>
        <Field label={t('elders.emergencyName')}>{(id) => <Input id={id} value={val(form.emergency_contact_name)} onChange={(e) => set('emergency_contact_name', e.target.value)} />}</Field>
        <Field label={t('elders.emergencyPhone')}>{(id) => <Input id={id} type="tel" value={val(form.emergency_contact_phone)} onChange={(e) => set('emergency_contact_phone', e.target.value)} />}</Field>
        {error && (
          <div className="sm:col-span-2">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
      </form>
    </Modal>
  )
}
