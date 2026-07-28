import { redirect } from 'next/navigation'

export default function SearchStoragePage() {
  redirect('/dashboard/storage/overview?mode=search')
}
