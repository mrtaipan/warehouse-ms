import { redirect } from 'next/navigation'

export default function DaftarBarangRedirectPage() {
  redirect('/dashboard/storage/overview?mode=product-directory')
}
