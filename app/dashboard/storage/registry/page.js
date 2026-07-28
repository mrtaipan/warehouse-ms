import { redirect } from 'next/navigation'

export default function RegistryStoragePage() {
  redirect('/dashboard/storage/overview?register=1')
}
