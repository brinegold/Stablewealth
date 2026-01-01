'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { ArrowLeft, User, Mail, Phone, Globe, Key, LogOut, Save } from 'lucide-react'
import Link from 'next/link'

interface Profile {
  id: string
  full_name: string
  country: string
  mobile_no: string
  referral_code: string

}

export default function ProfilePage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [formData, setFormData] = useState({
    fullName: '',
    country: '',
    mobileNo: '',
    password: ''
  })
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createSupabaseClient()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchProfile()
    }
  }, [user])

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single()

      if (error) throw error

      setProfile(data)
      setFormData({
        fullName: data.full_name || '',
        country: data.country || '',
        mobileNo: data.mobile_no || '',
        password: ''
      })
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName,
          country: formData.country,
          mobile_no: formData.mobileNo
        })
        .eq('id', user?.id)

      if (profileError) throw profileError

      // Update password if provided
      if (formData.password) {
        const { error: passwordError } = await (supabase.auth as any).updateUser({
          password: formData.password
        })

        if (passwordError) throw passwordError
      }

      setSuccess('Profile updated successfully!')
      setIsEditing(false)
      fetchProfile()

      // Clear password field
      setFormData(prev => ({ ...prev, password: '' }))

    } catch (error: any) {
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/')
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen jarvis-gradient flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen jarvis-gradient">
      {/* Header */}
      <header className="border-b border-white/20 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="text-white hover:text-blue-300">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-xl font-bold text-white">Edit Profile</h1>
          <div></div>
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-md">
        {/* Profile Avatar */}
        <div className="text-center mb-6">
          <div className="w-24 h-24 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="h-12 w-12 text-white" />
          </div>
          <h2 className="text-white text-xl font-bold">{profile?.full_name}</h2>
          <p className="text-gray-300">User ID: {profile?.referral_code}</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/20 border border-green-500 text-green-200 px-4 py-3 rounded-lg mb-4">
            {success}
          </div>
        )}

        {/* Profile Form */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <div className="space-y-6">
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={profile?.referral_code || ''}
                  disabled
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-lg text-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Name
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full px-4 py-3 border border-white/20 rounded-lg text-white ${isEditing ? 'bg-white/10' : 'bg-white/5'
                  } ${isEditing ? '' : 'text-gray-400'}`}
              />
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Country
              </label>
              <select
                name="country"
                value={formData.country}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full px-4 py-3 border border-white/20 rounded-lg text-white ${isEditing ? 'bg-white/10' : 'bg-white/5'
                  } ${isEditing ? '' : 'text-gray-400'}`}
              >
                <option value="" className="bg-gray-800">--Select--</option>
                <option value="US" className="bg-gray-800">United States</option>
                <option value="UK" className="bg-gray-800">United Kingdom</option>
                <option value="CA" className="bg-gray-800">Canada</option>
                <option value="AU" className="bg-gray-800">Australia</option>
                <option value="DE" className="bg-gray-800">Germany</option>
                <option value="FR" className="bg-gray-800">France</option>
                <option value="IN" className="bg-gray-800">India</option>
                <option value="PK" className="bg-gray-800">Pakistan</option>
                <option value="BD" className="bg-gray-800">Bangladesh</option>
                <option value="NG" className="bg-gray-800">Nigeria</option>
              </select>
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Mobile No
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="tel"
                  name="mobileNo"
                  value={formData.mobileNo}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className={`w-full pl-10 pr-4 py-3 border border-white/20 rounded-lg text-white ${isEditing ? 'bg-white/10' : 'bg-white/5'
                    } ${isEditing ? '' : 'text-gray-400'}`}
                />
              </div>
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-lg text-gray-400"
                />
              </div>
            </div>



            {isEditing && (
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Enter Password
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter new password (optional)"
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 space-y-4">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full jarvis-button py-3 rounded-lg text-white font-semibold"
              >
                Edit Profile
              </button>
            ) : (
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setIsEditing(false)
                    setError('')
                    setSuccess('')
                    fetchProfile() // Reset form data
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 py-3 rounded-lg text-white font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 jarvis-button py-3 rounded-lg text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      SAVE
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-lg text-white font-semibold transition-colors flex items-center justify-center"
        >
          <LogOut className="h-5 w-5 mr-2" />
          LOGOUT
        </button>

        {/* Account Info */}
        <div className="mt-6 jarvis-card rounded-xl p-4">
          <h3 className="text-white font-semibold mb-2">Account Information</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">Account Status:</span>
              <span className="text-green-400">Active</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Member Since:</span>
              <span className="text-white">
                {new Date(user?.created_at || '').toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Referral Code:</span>
              <span className="text-yellow-400 font-mono">{profile?.referral_code}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
