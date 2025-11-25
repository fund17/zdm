'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Folder, CheckCircle, AlertCircle, X, Loader2, FolderOpen, Image, FileSpreadsheet, File, Trash2 } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'

interface UploadFolder {
  id: string
  name: string
  description: string
  icon: typeof Folder
  color: string
  folderId: string
}

const UPLOAD_FOLDERS: UploadFolder[] = [
  {
    id: 'HWPOXLS_UPDATE',
    name: 'Huawei PO XLS Update',
    description: 'Upload files for XLS PO updates',
    icon: FileSpreadsheet,
    color: 'blue',
    folderId: '142ti_4bDTEOY7x5bYIFj3nAGcnLnTvTP'
  },
  {
    id: 'HWPOTSEL_UPDATE',
    name: 'Huawei PO TSEL Update',
    description: 'Upload files for TSEL PO updates',
    icon: FileSpreadsheet,
    color: 'green',
    folderId: '1acCyxmCDDARCknQohSsRwlWxZh8c7qHX'
  },
  {
    id: 'HWPOIOH_UPDATE',
    name: 'Huawei PO IOH Update',
    description: 'Upload files for IOH PO updates',
    icon: FileSpreadsheet,
    color: 'purple',
    folderId: '1flu7jHcddGUWXCUQKyPB_xKSX83U8c4W'
  },
]

interface UploadedFile {
  name: string
  size: number
  status: 'uploading' | 'success' | 'error'
  progress: number
  error?: string
  id?: string
}

interface DriveFile {
  id: string
  name: string
  mimeType: string
  size: number
  webViewLink: string
  webContentLink: string
  createdTime: string
  modifiedTime: string
}

function FileUploadPage() {
  const router = useRouter()
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [folderFiles, setFolderFiles] = useState<DriveFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  // Fetch user session on mount
  useEffect(() => {
    const fetchUserSession = async () => {
      try {
        const res = await fetch('/api/auth/session')
        if (res.ok) {
          const data = await res.json()
          setUserRole(data.user?.role || null)
        }
      } catch (error) {

      }
    }
    fetchUserSession()
  }, [])

  // Fetch folder files when folder is selected
  useEffect(() => {
    if (selectedFolder) {
      fetchFolderFiles()
    }
  }, [selectedFolder])

  const fetchFolderFiles = async () => {
    if (!selectedFolder) return

    const folderConfig = UPLOAD_FOLDERS.find(f => f.id === selectedFolder)
    if (!folderConfig) return

    setLoadingFiles(true)
    try {
      const response = await fetch(
        `/api/file-upload/list-files?folderId=${folderConfig.folderId}`
      )

      if (response.ok) {
        const data = await response.json()
        setFolderFiles(data.files || [])
      } else {

        setFolderFiles([])
      }
    } catch (error) {

      setFolderFiles([])
    } finally {
      setLoadingFiles(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (!selectedFolder) {
      alert('Please select a folder first')
      return
    }

    const droppedFiles = Array.from(e.dataTransfer.files)
    handleFiles(droppedFiles)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedFolder) {
      alert('Please select a folder first')
      return
    }

    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      handleFiles(selectedFiles)
      // Reset input so same file can be selected again
      e.target.value = ''
    }
  }

  const handleFiles = async (fileList: File[]) => {
    if (!selectedFolder) return

    const folderConfig = UPLOAD_FOLDERS.find(f => f.id === selectedFolder)
    if (!folderConfig) return

    setUploading(true)

    // Initialize files with uploading status
    const newFiles: UploadedFile[] = fileList.map(file => ({
      name: file.name,
      size: file.size,
      status: 'uploading',
      progress: 0
    }))

    setFiles(prev => [...prev, ...newFiles])

    // Upload each file
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      const fileIndex = files.length + i

      try {
        // Convert file to base64
        const base64 = await fileToBase64(file)

        // Upload to server
        const response = await fetch('/api/file-upload/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type,
            fileData: base64,
            folderId: folderConfig.folderId,
          }),
        })

        if (!response.ok) {
          throw new Error('Upload failed')
        }

        const result = await response.json()

        if (result.success) {
          setFiles(prev => {
            const updated = [...prev]
            updated[fileIndex] = {
              ...updated[fileIndex],
              status: 'success',
              progress: 100,
              id: result.file.id
            }
            return updated
          })
        } else {
          throw new Error(result.error || 'Upload failed')
        }
      } catch (error) {
        setFiles(prev => {
          const updated = [...prev]
          updated[fileIndex] = {
            ...updated[fileIndex],
            status: 'error',
            progress: 0,
            error: error instanceof Error ? error.message : 'Upload failed'
          }
          return updated
        })
      }
    }

    setUploading(false)
    
    // Refresh folder files after upload
    await fetchFolderFiles()
  }

  const handleDeleteFile = async (fileId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return

    try {
      const response = await fetch('/api/drive/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileId }),
      })

      if (response.ok) {
        // Refresh folder files
        await fetchFolderFiles()
      } else {
        alert('Failed to delete file')
      }
    } catch (error) {

      alert('Error deleting file')
    }
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        const base64 = reader.result as string
        // Remove data:mime/type;base64, prefix
        resolve(base64.split(',')[1])
      }
      reader.onerror = error => reject(error)
    })
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const clearAll = () => {
    setFiles([])
  }

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'].includes(ext || '')) {
      return <Image className="h-5 w-5 text-purple-600" />
    } else if (['xls', 'xlsx', 'csv'].includes(ext || '')) {
      return <FileSpreadsheet className="h-5 w-5 text-green-600" />
    } else if (['pdf'].includes(ext || '')) {
      return <FileText className="h-5 w-5 text-red-600" />
    }
    return <File className="h-5 w-5 text-gray-600" />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">File Upload Center</h1>
          <p className="text-gray-600">Upload files to specific folders in Google Drive</p>
        </div>

        {/* Folder Selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-blue-600" />
            Select Destination Folder
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {UPLOAD_FOLDERS.map((folder) => {
              const Icon = folder.icon
              const isSelected = selectedFolder === folder.id
              
              return (
                <button
                  key={folder.id}
                  onClick={() => {
                    setSelectedFolder(folder.id)
                    setFiles([])
                  }}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    isSelected
                      ? folder.color === 'blue' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : folder.color === 'green' ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                      : folder.color === 'purple' ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                      : 'border-gray-500 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                      isSelected 
                        ? folder.color === 'blue' ? 'bg-blue-100'
                        : folder.color === 'green' ? 'bg-green-100'
                        : folder.color === 'purple' ? 'bg-purple-100'
                        : 'bg-gray-100'
                        : 'bg-gray-100'
                    }`}>
                      <Icon className={`h-6 w-6 ${
                        isSelected
                          ? folder.color === 'blue' ? 'text-blue-600'
                          : folder.color === 'green' ? 'text-green-600'
                          : folder.color === 'purple' ? 'text-purple-600'
                          : 'text-gray-600'
                          : 'text-gray-600'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-1">{folder.name}</h3>
                      <p className="text-xs text-gray-600 line-clamp-2">{folder.description}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>


        {/* File List */}
        {files.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-gray-600" />
                Upload Queue ({files.length})
              </h2>
              {files.some(f => f.status === 'success') && (
                <button
                  onClick={clearAll}
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    file.status === 'success'
                      ? 'border-green-200 bg-green-50'
                      : file.status === 'error'
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  {/* File Icon */}
                  <div className="flex-shrink-0">
                    {getFileIcon(file.name)}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-xs text-gray-600">{formatFileSize(file.size)}</p>
                    {file.error && (
                      <p className="text-xs text-red-600 mt-1">{file.error}</p>
                    )}
                  </div>

                  {/* Status */}
                  <div className="flex-shrink-0">
                    {file.status === 'uploading' && (
                      <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                    )}
                    {file.status === 'success' && (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                    {file.status === 'error' && (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>

                  {/* Remove Button */}
                  {file.status !== 'uploading' && (
                    <button
                      onClick={() => removeFile(index)}
                      className="flex-shrink-0 p-1 hover:bg-gray-200 rounded transition-colors"
                    >
                      <X className="h-4 w-4 text-gray-500" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-gray-600">
                  <span className="font-semibold text-green-600">
                    {files.filter(f => f.status === 'success').length}
                  </span> uploaded
                </span>
                {files.some(f => f.status === 'error') && (
                  <span className="text-gray-600">
                    <span className="font-semibold text-red-600">
                      {files.filter(f => f.status === 'error').length}
                    </span> failed
                  </span>
                )}
                {files.some(f => f.status === 'uploading') && (
                  <span className="text-gray-600">
                    <span className="font-semibold text-blue-600">
                      {files.filter(f => f.status === 'uploading').length}
                    </span> uploading
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Folder Files List */}
        {selectedFolder && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Folder className="h-5 w-5 text-gray-600" />
                Files in {UPLOAD_FOLDERS.find(f => f.id === selectedFolder)?.name}
              </h2>
              <div className="flex items-center gap-2">
                {/* Upload Button */}
                <label className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
                  <Upload className="h-4 w-4" />
                  Upload Files
                  <input
                    type="file"
                    multiple
                    onChange={handleFileInput}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={fetchFolderFiles}
                  disabled={loadingFiles}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loadingFiles ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>

            {/* Drag & Drop Zone - Compact Version */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center mb-4 transition-all ${
                dragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              <Upload className={`h-8 w-8 mx-auto mb-2 ${
                dragActive ? 'text-blue-500' : 'text-gray-400'
              }`} />
              <p className="text-sm text-gray-600">
                {dragActive ? 'Drop files here' : 'Drag & drop files here to upload'}
              </p>
            </div>

            {loadingFiles ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              </div>
            ) : folderFiles.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Folder className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No files in this folder yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {folderFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all"
                  >
                    {/* File Icon */}
                    <div className="flex-shrink-0">
                      {getFileIcon(file.name)}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                      <p className="text-xs text-gray-600">
                        {formatFileSize(file.size)} • {new Date(file.modifiedTime).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {userRole === 'admin' && (
                        <button
                          onClick={() => handleDeleteFile(file.id, file.name)}
                          className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function FileUploadPageWithAuth() {
  return (
    <ProtectedRoute requiredMenu="File Upload Center">
      <FileUploadPage />
    </ProtectedRoute>
  )
}
