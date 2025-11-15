'use client'

import { useState, useEffect } from 'react'
import { X, Package, FileText, Loader2, AlertCircle, FolderOpen, Upload, Download, Trash2, Eye } from 'lucide-react'

interface SiteDetailModalProps {
  isOpen: boolean
  onClose: () => void
  duid: string
  duName?: string
  selectedSheet?: string
}

interface POData {
  'SITE ID': string
  'SITE NAME': string
  'PO NUMBER': string
  'PO DATE': string
  'PO ITEM': string
  'MATERIAL': string
  'QTY': number
  'UNIT': string
  'PRICE': number
  'TOTAL': number
  [key: string]: any
}

interface DriveFile {
  id: string
  name: string
  mimeType: string
  size: number
  createdDate: string
  modifiedDate?: string
  url: string
  downloadUrl?: string
  thumbnailUrl?: string
  webViewLink: string
  isFolder?: boolean
}

interface DriveFolder {
  id: string
  name: string
  createdDate: string
  filesCount?: number
}

interface DailyPlanData {
  [key: string]: any
}

type TabType = 'po' | 'files' | 'dailyplan'

export function SiteDetailModal({ isOpen, onClose, duid, duName, selectedSheet }: SiteDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('files')
  const [poData, setPOData] = useState<POData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // PO filter state
  const [selectedPOStatus, setSelectedPOStatus] = useState<string | null>(null)
  
  // Files tab state
  const [files, setFiles] = useState<DriveFile[]>([])
  const [folders, setFolders] = useState<DriveFolder[]>([])
  const [currentPath, setCurrentPath] = useState<string[]>([]) // Breadcrumb path
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [filesLoading, setFilesLoading] = useState(false)
  const [filesError, setFilesError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  
  // Preview modal state
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  
  // Create folder state
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  
  // Daily Plan tab state
  const [dailyPlanData, setDailyPlanData] = useState<DailyPlanData[]>([])
  const [dailyPlanLoading, setDailyPlanLoading] = useState(false)
  const [dailyPlanError, setDailyPlanError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && activeTab === 'po') {
      fetchPOData()
    }
    if (isOpen && activeTab === 'files') {
      fetchFiles()
    }
    if (isOpen && activeTab === 'dailyplan') {
      fetchDailyPlanData()
    }
  }, [isOpen, activeTab])

  const fetchPOData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Determine which PO sheet to load based on selectedSheet
      const sheetMapping: Record<string, string> = {
        'ITCXLS': 'po-xls',
        'ITCHXLS': 'po-xls',
        'ITCXL': 'po-xl',
        'ITCHXL': 'po-xl',
        'ITCIOH': 'po-ioh',
        'ITCHIOH': 'po-ioh',
        'ITCTSEL': 'po-tsel',
        'ITCHTSEL': 'po-tsel',
        'RNOXLS': 'po-rno-xls',
        'RNOHXLS': 'po-rno-xls',
        'RNOXL': 'po-rno-xl',
        'RNOHXL': 'po-rno-xl',
        'RNOIOH': 'po-rno-ioh',
        'RNOHIOH': 'po-rno-ioh',
        'RNOTSEL': 'po-rno-tsel',
        'RNOHTSEL': 'po-rno-tsel',
      }

      const poSheet = selectedSheet ? sheetMapping[selectedSheet] || 'po-xls' : 'po-xls'
      const cacheKey = `po_huawei_${poSheet}_cache`
      const timestampKey = `po_huawei_${poSheet}_timestamp`

      // Check localStorage first
      const cachedData = localStorage.getItem(cacheKey)
      const cacheTimestamp = localStorage.getItem(timestampKey)
      const cacheExpiry = 30 * 60 * 1000 // 30 minutes

      let allPOData: POData[] = []

      if (cachedData && cacheTimestamp) {
        const age = Date.now() - parseInt(cacheTimestamp)
        if (age < cacheExpiry) {
          allPOData = JSON.parse(cachedData)
        }
      }

      // Fetch from API if no cache or expired
      if (allPOData.length === 0) {
        const response = await fetch(`/api/sheets/${poSheet}`)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch PO data: ${response.status}`)
        }

        const result = await response.json()

        if (!result.success || !result.data) {
          throw new Error(result.message || 'No PO data returned')
        }

        allPOData = result.data

        // Store to localStorage
        try {
          localStorage.setItem(cacheKey, JSON.stringify(allPOData))
          localStorage.setItem(timestampKey, Date.now().toString())
        } catch (storageError) {
          // Silent fail - localStorage might be full or disabled
        }
      }

      // Filter by Site ID - try exact match first
      let filteredPO = allPOData.filter((po: POData) => {
        const siteId = po['Site ID']?.toString().trim()
        return siteId === duid.trim()
      })

      // If no exact match, try partial match (DUID might be part of Site ID)
      if (filteredPO.length === 0) {
        filteredPO = allPOData.filter((po: POData) => {
          const siteId = po['Site ID']?.toString().trim().toLowerCase()
          const duidLower = duid.trim().toLowerCase()
          return siteId?.includes(duidLower) || duidLower?.includes(siteId)
        })
      }
      
      setPOData(filteredPO)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const fetchFiles = async (folderId?: string) => {
    try {
      setFilesLoading(true)
      setFilesError(null)

      let url = `/api/drive/list-files?duid=${encodeURIComponent(duid)}`
      if (folderId) {
        url += `&folderId=${encodeURIComponent(folderId)}`
      }

      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error('Failed to fetch files')
      }

      const result = await response.json()
      
      if (result.success) {
        setFiles(result.files || [])
        setFolders(result.folders || [])
      } else {
        throw new Error(result.error || 'Failed to fetch files')
      }
    } catch (err) {
      console.error('Failed to fetch files:', err)
      setFilesError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setFilesLoading(false)
    }
  }

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    try {
      setUploading(true)
      setUploadProgress(0)
      setFilesError(null)

      const totalFiles = files.length
      let uploadedCount = 0

      // Upload files sequentially
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        
        // Create FormData for each file
        const formData = new FormData()
        formData.append('file', file)
        formData.append('duid', duid)
        if (currentFolderId) {
          formData.append('folderId', currentFolderId)
        }

        const response = await fetch('/api/drive/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`)
        }

        const result = await response.json()
        
        if (!result.success) {
          throw new Error(result.error || `Failed to upload ${file.name}`)
        }

        uploadedCount++
        setUploadProgress(Math.round((uploadedCount / totalFiles) * 100))
      }

      // Refresh file list after all uploads
      await fetchFiles(currentFolderId || undefined)
      // Reset file input
      event.target.value = ''
    } catch (err) {
      console.error('Failed to upload files:', err)
      setFilesError(err instanceof Error ? err.message : 'Failed to upload files')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return

    try {
      setCreatingFolder(true)
      setFilesError(null)

      const response = await fetch('/api/drive/create-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          duid: duid,
          folderName: newFolderName.trim(),
          parentFolderId: currentFolderId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create folder')
      }

      const result = await response.json()
      
      if (result.success) {
        // Refresh file list
        await fetchFiles(currentFolderId || undefined)
        setNewFolderName('')
        setShowCreateFolder(false)
      } else {
        throw new Error(result.error || 'Failed to create folder')
      }
    } catch (err) {
      console.error('Failed to create folder:', err)
      setFilesError(err instanceof Error ? err.message : 'Failed to create folder')
    } finally {
      setCreatingFolder(false)
    }
  }

  const handleDeleteFile = async (fileId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return
    }

    try {
      setFilesError(null)

      const response = await fetch('/api/drive/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'deleteFile',
          fileId: fileId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to delete file')
      }

      // Refresh file list
      await fetchFiles(currentFolderId || undefined)
    } catch (err) {
      console.error('Failed to delete file:', err)
      setFilesError(err instanceof Error ? err.message : 'Failed to delete file')
    }
  }

  const handleFolderClick = (folder: DriveFolder) => {
    setCurrentPath([...currentPath, folder.name])
    setCurrentFolderId(folder.id)
    fetchFiles(folder.id)
  }

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      // Back to root
      setCurrentPath([])
      setCurrentFolderId(null)
      fetchFiles()
    } else {
      // Back to specific folder in path
      const newPath = currentPath.slice(0, index + 1)
      setCurrentPath(newPath)
      // Need to get folder ID from path - simplified: just go back to root for now
      setCurrentFolderId(null)
      fetchFiles()
    }
  }

  const handlePreviewFile = (file: DriveFile) => {
    // Preview all files in modal
    setPreviewFile(file)
    setShowPreview(true)
  }
  
  const fetchDailyPlanData = async () => {
    try {
      setDailyPlanLoading(true)
      setDailyPlanError(null)

      const response = await fetch('/api/sheets')
      
      if (!response.ok) {
        throw new Error('Failed to fetch daily plan data')
      }

      const result = await response.json()
      
      if (result.data) {
        // Filter data by DUID
        const filtered = result.data.filter((row: any) => 
          row['DUID'] === duid || row['Site ID'] === duid || row['SITE ID'] === duid
        )
        setDailyPlanData(filtered)
      } else {
        throw new Error('No data found')
      }
    } catch (err) {
      console.error('Failed to fetch daily plan data:', err)
      setDailyPlanError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setDailyPlanLoading(false)
    }
  }

  const canPreviewInline = (mimeType: string) => {
    const type = mimeType.toLowerCase()
    return (
      type.startsWith('image/') ||
      type === 'application/pdf' ||
      type.startsWith('video/') ||
      type.startsWith('audio/') ||
      type === 'text/plain' ||
      type === 'text/html' ||
      type === 'text/csv' ||
      type === 'application/json'
    )
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <div className="p-2 bg-blue-500 rounded-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              Site Details - {duid}
            </h2>
            {duName && (
              <p className="text-sm text-gray-600 mt-1 ml-11">{duName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-5">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('files')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'files'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                <span>Files</span>
                {files.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full text-xs font-semibold">
                    {files.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('dailyplan')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'dailyplan'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>Daily Plan</span>
                {dailyPlanData.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-green-100 text-green-600 rounded-full text-xs font-semibold">
                    {dailyPlanData.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('po')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'po'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span>Purchase Orders</span>
                {poData.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-xs font-semibold">
                    {poData.length}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Files Tab */}
          {activeTab === 'files' && (
            <div>
              {/* Header Section */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-500 rounded-lg">
                    <FolderOpen className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Files & Documents</h3>
                    {/* Breadcrumb */}
                    {currentPath.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                        <button 
                          onClick={() => handleBreadcrumbClick(-1)}
                          className="hover:text-blue-600 transition-colors"
                        >
                          Root
                        </button>
                        {currentPath.map((folder, index) => (
                          <div key={index} className="flex items-center gap-1">
                            <span>/</span>
                            <button 
                              onClick={() => handleBreadcrumbClick(index)}
                              className="hover:text-blue-600 transition-colors"
                            >
                              {folder}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCreateFolder(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                  >
                    <FolderOpen className="h-4 w-4" />
                    <span>New Folder</span>
                  </button>
                  
                  <label className="relative cursor-pointer">
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                    <div className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${
                      uploading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}>
                      <Upload className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {uploading ? `Uploading... ${uploadProgress}%` : 'Upload Files'}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Content Section */}
              <div>
                {/* Upload Progress */}
                {uploading && (
                  <div className="mb-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Uploading... {uploadProgress}%</p>
                  </div>
                )}

                {/* Files Error */}
                {filesError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 mb-4">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-900">Error</p>
                      <p className="text-xs text-red-700 mt-1">{filesError}</p>
                    </div>
                  </div>
                )}

                {/* Loading State */}
                {filesLoading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                    <span className="ml-3 text-sm text-gray-600">Loading files...</span>
                  </div>
                )}

                {/* Empty State */}
                {!filesLoading && folders.length === 0 && files.length === 0 && (
                  <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                    <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-900 mb-1">No files or folders yet</p>
                    <p className="text-xs text-gray-600">Create a folder or upload your first file to get started</p>
                  </div>
                )}

                {/* Folders Grid - Compact */}
                {!filesLoading && folders.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Folders</h4>
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {folders.map((folder) => (
                        <button
                          key={folder.id}
                          onClick={() => handleFolderClick(folder)}
                          className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-orange-200 rounded-lg p-2 hover:shadow-sm transition-all group text-left"
                        >
                          <div className="flex flex-col items-center gap-1">
                            <FolderOpen className="h-6 w-6 text-orange-500 group-hover:text-orange-600 transition-colors" />
                            <p className="text-xs font-medium text-gray-900 truncate w-full text-center">{folder.name}</p>
                            {folder.filesCount !== undefined && (
                              <p className="text-[10px] text-gray-500">{folder.filesCount}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Files Grid - Compact */}
                {!filesLoading && files.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Files</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="bg-white border border-gray-200 rounded-lg p-2 hover:shadow-sm transition-all group"
                        >
                          <div className="flex items-center gap-2">
                            {/* File Icon - Smaller */}
                            <button
                              onClick={() => handlePreviewFile(file)}
                              className="flex-shrink-0 cursor-pointer hover:opacity-75 transition-opacity"
                            >
                              {file.thumbnailUrl ? (
                                <img
                                  src={file.thumbnailUrl}
                                  alt={file.name}
                                  className="w-10 h-10 object-cover rounded"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                                  <FileText className="h-5 w-5 text-blue-600" />
                                </div>
                              )}
                            </button>

                            {/* File Info - Compact */}
                            <div className="flex-1 min-w-0">
                              <button
                                onClick={() => handlePreviewFile(file)}
                                className="text-sm font-medium text-gray-900 truncate hover:text-blue-600 transition-colors text-left w-full"
                              >
                                {file.name}
                              </button>
                              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                <span>{formatFileSize(file.size)}</span>
                                <span>•</span>
                                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
                                  {file.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
                                </span>
                              </div>
                            </div>

                            {/* Actions - Compact */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handlePreviewFile(file)}
                                className="p-1.5 bg-purple-50 text-purple-600 rounded hover:bg-purple-100 transition-colors"
                                title="Preview"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                                title="Open in Drive"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </a>
                              {file.downloadUrl && (
                                <a
                                  href={file.downloadUrl}
                                  download
                                  className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors"
                                  title="Download"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Daily Plan Tab */}
          {activeTab === 'dailyplan' && (
            <div>
              {/* Header Section */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Daily Plan Activities</h3>
                    {dailyPlanData.length > 0 && (
                      <p className="text-sm text-gray-600">{dailyPlanData.length} record{dailyPlanData.length !== 1 ? 's' : ''}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Content Section */}
              <div>
                {dailyPlanLoading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 text-green-500 animate-spin" />
                    <span className="ml-3 text-sm text-gray-600">Loading daily plan data...</span>
                  </div>
                )}

                {dailyPlanError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-900">Error loading data</p>
                      <p className="text-xs text-red-700 mt-1">{dailyPlanError}</p>
                    </div>
                  </div>
                )}

                {!dailyPlanLoading && !dailyPlanError && dailyPlanData.length === 0 && (
                  <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-900 mb-1">No Daily Plan data found</p>
                    <p className="text-xs text-gray-600">No records found for DUID: {duid}</p>
                  </div>
                )}

                {!dailyPlanLoading && !dailyPlanError && dailyPlanData.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            {Object.keys(dailyPlanData[0]).map((key) => (
                              <th
                                key={key}
                                className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wide whitespace-nowrap"
                              >
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {dailyPlanData.map((row, rowIndex) => (
                            <tr key={rowIndex} className="hover:bg-gray-50 transition-colors">
                              {Object.entries(row).map(([key, value], cellIndex) => (
                                <td
                                  key={cellIndex}
                                  className="px-3 py-2 text-xs text-gray-900 whitespace-nowrap"
                                >
                                  {value?.toString() || '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PO Tab */}
          {activeTab === 'po' && (
            <div>
              {/* Header Section */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <Package className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Purchase Orders</h3>
                  </div>
                </div>
                <button
                  onClick={() => {
                    // Clear all PO caches
                    Object.keys(localStorage).forEach(key => {
                      if (key.startsWith('po_huawei_')) {
                        localStorage.removeItem(key)
                      }
                    })
                    fetchPOData()
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  title="Clear cache and reload from API"
                >
                  🔄 Refresh
                </button>
              </div>

              {/* Content Section */}
              <div>
                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                    <span className="ml-3 text-sm text-gray-600">Loading PO data...</span>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-900">Error Loading PO Data</p>
                      <p className="text-xs text-red-700 mt-1">{error}</p>
                    </div>
                  </div>
                )}

                {!loading && !error && poData.length === 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                    <AlertCircle className="h-8 w-8 text-yellow-500 mx-auto mb-3" />
                    <p className="text-sm font-medium text-yellow-900">No PO Data Found</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      No purchase orders found for DUID: {duid}
                    </p>
                  </div>
                )}

                {!loading && !error && poData.length > 0 && (
                  <div className="space-y-4">
                    {/* PO Status Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      {(() => {
                        const statusCounts = poData.reduce((acc: Record<string, number>, po) => {
                          const status = po['PO Status'] || 'Unknown'
                          acc[status] = (acc[status] || 0) + 1
                          return acc
                        }, {})
                        
                        return Object.entries(statusCounts).map(([status, count]) => {
                          const isSelected = selectedPOStatus === status
                          return (
                            <button
                              key={status}
                              onClick={() => setSelectedPOStatus(isSelected ? null : status)}
                              className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer hover:scale-105 ${
                                isSelected 
                                  ? 'ring-2 ring-offset-2 shadow-md' 
                                  : 'hover:shadow-sm'
                              } ${
                                status.toLowerCase().includes('complete') || status.toLowerCase().includes('closed') 
                                  ? isSelected 
                                    ? 'bg-green-200 border-2 border-green-500 ring-green-400' 
                                    : 'bg-green-100 border border-green-300'
                                  :
                                status.toLowerCase().includes('progress') || status.toLowerCase().includes('open')
                                  ? isSelected
                                    ? 'bg-yellow-200 border-2 border-yellow-500 ring-yellow-400'
                                    : 'bg-yellow-100 border border-yellow-300'
                                  :
                                status.toLowerCase().includes('cancel')
                                  ? isSelected
                                    ? 'bg-red-200 border-2 border-red-500 ring-red-400'
                                    : 'bg-red-100 border border-red-300'
                                  :
                                  isSelected
                                    ? 'bg-gray-200 border-2 border-gray-500 ring-gray-400'
                                    : 'bg-gray-100 border border-gray-300'
                              }`}
                            >
                              <span className={`text-xs font-semibold ${
                                status.toLowerCase().includes('complete') || status.toLowerCase().includes('closed')
                                  ? 'text-green-900' :
                                status.toLowerCase().includes('progress') || status.toLowerCase().includes('open')
                                  ? 'text-yellow-900' :
                                status.toLowerCase().includes('cancel')
                                  ? 'text-red-900' :
                                'text-gray-900'
                              }`}>
                                {status}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                status.toLowerCase().includes('complete') || status.toLowerCase().includes('closed')
                                  ? 'bg-green-200 text-green-900' :
                                status.toLowerCase().includes('progress') || status.toLowerCase().includes('open')
                                  ? 'bg-yellow-200 text-yellow-900' :
                                status.toLowerCase().includes('cancel')
                                  ? 'bg-red-200 text-red-900' :
                                'bg-gray-200 text-gray-900'
                              }`}>
                                {count}
                              </span>
                            </button>
                          )
                        })
                      })()}
                      
                      {selectedPOStatus && (
                        <button
                          onClick={() => setSelectedPOStatus(null)}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          ✕ Clear Filter
                        </button>
                      )}
                    </div>

                    {/* PO Table */}
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wide whitespace-nowrap">No</th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wide whitespace-nowrap">Project No</th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wide whitespace-nowrap">Project Name</th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wide whitespace-nowrap">PO Number</th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wide whitespace-nowrap">Site ID</th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wide whitespace-nowrap">Site Name</th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wide whitespace-nowrap">Area</th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wide whitespace-nowrap">SOW</th>
                              <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-700 uppercase tracking-wide whitespace-nowrap">Qty</th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wide whitespace-nowrap">Unit</th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wide whitespace-nowrap">Start Date</th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wide whitespace-nowrap">End Date</th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wide whitespace-nowrap">PO Status</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100">
                            {poData
                              .filter(po => !selectedPOStatus || po['PO Status'] === selectedPOStatus)
                              .map((po, index) => (
                                <tr key={index} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-3 py-2 text-xs text-gray-900 whitespace-nowrap">{po['No.'] || '-'}</td>
                                  <td className="px-3 py-2 text-xs text-gray-900 whitespace-nowrap">{po['Project No.'] || '-'}</td>
                                  <td className="px-3 py-2 text-xs text-gray-900 whitespace-nowrap max-w-xs truncate" title={po['Project Name']}>{po['Project Name'] || '-'}</td>
                                  <td className="px-3 py-2 text-xs font-mono text-gray-900 whitespace-nowrap">{po['PO Number '] || '-'}</td>
                                  <td className="px-3 py-2 text-xs text-gray-900 whitespace-nowrap">{po['Site ID'] || '-'}</td>
                                  <td className="px-3 py-2 text-xs text-gray-900 whitespace-nowrap max-w-xs truncate" title={po['Site Name']}>{po['Site Name'] || '-'}</td>
                                  <td className="px-3 py-2 text-xs text-gray-900 whitespace-nowrap">{po['Area'] || '-'}</td>
                                  <td className="px-3 py-2 text-xs text-gray-900 whitespace-nowrap">{po['SOW'] || '-'}</td>
                                  <td className="px-3 py-2 text-xs text-right font-medium text-gray-900 whitespace-nowrap">
                                    {Number(po['Qty'])?.toLocaleString() || '0'}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-gray-900 whitespace-nowrap">{po['Unit'] || '-'}</td>
                                  <td className="px-3 py-2 text-xs text-gray-900 whitespace-nowrap">{po['Start Date'] || '-'}</td>
                                  <td className="px-3 py-2 text-xs text-gray-900 whitespace-nowrap">{po['End Date'] || '-'}</td>
                                  <td className="px-3 py-2 text-xs text-gray-900 whitespace-nowrap">
                                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                                      po['PO Status']?.toLowerCase().includes('complete') || po['PO Status']?.toLowerCase().includes('closed')
                                        ? 'bg-green-100 text-green-800' :
                                      po['PO Status']?.toLowerCase().includes('progress') || po['PO Status']?.toLowerCase().includes('open')
                                        ? 'bg-yellow-100 text-yellow-800' :
                                      po['PO Status']?.toLowerCase().includes('cancel')
                                        ? 'bg-red-100 text-red-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {po['PO Status'] || '-'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>

      {/* Create Folder Modal */}
      {showCreateFolder && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Create New Folder</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder()
                if (e.key === 'Escape') setShowCreateFolder(false)
              }}
              placeholder="Folder name"
              autoFocus
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateFolder(false)
                  setNewFolderName('')
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || creatingFolder}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creatingFolder ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal - Clean Light Design */}
      {showPreview && previewFile && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-md p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-6xl max-h-[95vh] flex flex-col">
            {/* Preview Header - Clean */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <div className="flex-shrink-0">
                  {previewFile.thumbnailUrl ? (
                    <img src={previewFile.thumbnailUrl} alt="" className="w-8 h-8 object-cover rounded" />
                  ) : (
                    <div className="w-8 h-8 bg-blue-50 rounded flex items-center justify-center">
                      <FileText className="h-4 w-4 text-blue-600" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 truncate">{previewFile.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{formatFileSize(previewFile.size)}</span>
                    <span>•</span>
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-medium">
                      {previewFile.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 ml-4">
                <a
                  href={previewFile.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Open in Drive
                </a>
                {previewFile.downloadUrl && (
                  <a
                    href={previewFile.downloadUrl}
                    download
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                )}
                <button
                  onClick={() => {
                    setShowPreview(false)
                    setPreviewFile(null)
                  }}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Preview Body - Maximum Space */}
            <div className="flex-1 overflow-auto p-6 bg-gradient-to-br from-gray-50 to-white">
              {/* Images */}
              {previewFile.mimeType.startsWith('image/') && (
                <div className="flex items-center justify-center h-full">
                  <img
                    src={`https://drive.google.com/uc?export=view&id=${previewFile.id}`}
                    alt={previewFile.name}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  />
                </div>
              )}
              
              {/* PDFs */}
              {previewFile.mimeType === 'application/pdf' && (
                <iframe
                  src={`https://drive.google.com/file/d/${previewFile.id}/preview`}
                  className="w-full h-full min-h-[700px] rounded-lg border border-gray-200 bg-white"
                  title={previewFile.name}
                />
              )}
              
              {/* Videos */}
              {previewFile.mimeType.startsWith('video/') && (
                <div className="flex items-center justify-center h-full">
                  <video
                    controls
                    className="max-w-full max-h-full rounded-lg shadow-lg"
                    src={`https://drive.google.com/uc?export=download&id=${previewFile.id}`}
                  >
                    Your browser does not support video playback.
                  </video>
                </div>
              )}
              
              {/* Audio */}
              {previewFile.mimeType.startsWith('audio/') && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center">
                    <FileText className="h-10 w-10 text-purple-600" />
                  </div>
                  <audio
                    controls
                    className="w-full max-w-md"
                    src={`https://drive.google.com/uc?export=download&id=${previewFile.id}`}
                  >
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}
              
              {/* Text files, JSON, CSV */}
              {(previewFile.mimeType.startsWith('text/') || previewFile.mimeType === 'application/json') && (
                <iframe
                  src={`https://drive.google.com/file/d/${previewFile.id}/preview`}
                  className="w-full h-full min-h-[700px] rounded-lg border border-gray-200 bg-white"
                  title={previewFile.name}
                />
              )}
              
              {/* Google Docs, Sheets, Slides */}
              {(previewFile.mimeType.includes('document') || 
                previewFile.mimeType.includes('spreadsheet') || 
                previewFile.mimeType.includes('presentation')) && (
                <iframe
                  src={`https://drive.google.com/file/d/${previewFile.id}/preview`}
                  className="w-full h-full min-h-[700px] rounded-lg border border-gray-200 bg-white"
                  title={previewFile.name}
                />
              )}
              
              {/* Other files - fallback to Drive preview */}
              {!canPreviewInline(previewFile.mimeType) && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                    <FileText className="h-10 w-10 text-gray-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-900 mb-1">{previewFile.name}</p>
                    <p className="text-xs text-gray-500 mb-4">Preview not available for this file type</p>
                    <div className="flex items-center gap-2 justify-center">
                      <a
                        href={previewFile.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <FileText className="h-4 w-4" />
                        Open in Google Drive
                      </a>
                      {previewFile.downloadUrl && (
                        <a
                          href={previewFile.downloadUrl}
                          download
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
