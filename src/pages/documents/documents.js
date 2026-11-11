import React, { useCallback, useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { ArrowLeft, Eye, FileText, Loader2, Trash2, Upload, X } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../context/AuthContext";
import "./documents.css";

const MAX_FILE_SIZE = 1024 * 1024;

function formatSize(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value) {
  const unix = Number(value || 0);
  if (!unix) return "—";
  const date = new Date(unix * 1000);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function DocumentUploadModal({ onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (!file) {
      setError("Choose a PDF file to upload.");
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported.");
      return;
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      setError("The PDF must be between 1 byte and 1 MiB.");
      return;
    }

    try {
      setUploading(true);
      await api.uploadDocument(file);
      await onUploaded();
      onClose();
    } catch (err) {
      setError(err?.message || "We couldn't upload this document.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="documents-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !uploading) onClose();
    }}>
      <section className="documents-upload-modal" role="dialog" aria-modal="true" aria-labelledby="documents-upload-title">
        <div className="documents-modal-heading">
          <div>
            <span className="section-kicker">RESOURCE DOCUMENTS</span>
            <h2 id="documents-upload-title">Upload a document</h2>
            <p>Add a PDF to your resource profile.</p>
          </div>
          <button type="button" className="documents-icon-button" onClick={onClose} disabled={uploading} aria-label="Close upload dialog"><X size={19} /></button>
        </div>
        <form onSubmit={submit}>
          <label className="documents-file-picker">
            <FileText size={25} />
            <strong>{file ? file.name : "Choose a PDF file"}</strong>
            <span>{file ? formatSize(file.size) : "PDF only · Maximum file size 1 MiB"}</span>
            <input type="file" accept="application/pdf,.pdf" onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              setError("");
            }} />
          </label>
          {error && <div className="documents-error">{error}</div>}
          <div className="documents-modal-actions">
            <button type="button" className="button button-secondary" onClick={onClose} disabled={uploading}>Cancel</button>
            <button type="submit" className="button button-primary" disabled={uploading || !file}>
              {uploading ? <><Loader2 size={16} className="documents-spin" /> Uploading…</> : <><Upload size={16} /> Upload PDF</>}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Documents() {
  const { user } = useAuth();
  const isResource = String(user?.role || "").replace("USER_ROLE_", "") === "RESOURCE";
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewingId, setViewingId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.listDocuments();
      const items = Array.isArray(response.objects) ? response.objects : [];
      setDocuments(items);
    } catch (err) {
      setError(err?.message || "We couldn't load your documents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isResource) loadDocuments();
  }, [isResource, loadDocuments]);

  if (!isResource) return <Navigate to="/profile" replace />;

  const viewDocument = async (document) => {
    const objectId = document.object_id;
    // Open synchronously from the click so popup blockers do not block the PDF tab.
    const preview = window.open("about:blank", "_blank");
    if (!preview) {
      setError("Please allow pop-ups to view your PDF.");
      return;
    }

    try {
      setViewingId(objectId);
      setError("");
      preview.opener = null;
      const blob = await api.getDocument(objectId);
      const url = URL.createObjectURL(blob);
      preview.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      preview.close();
      setError(err?.message || "We couldn't open this document.");
    } finally {
      setViewingId("");
    }
  };

  const deleteDocument = async (document) => {
    const name = document.original_file_name || "this document";
    if (!window.confirm(`Delete "${name}"? This action cannot be undone.`)) return;

    try {
      setDeletingId(document.object_id);
      setError("");
      setMessage("");
      await api.deleteDocument(document.object_id);
      setDocuments((current) => current.filter((item) => item.object_id !== document.object_id));
      setMessage("Document deleted.");
    } catch (err) {
      setError(err?.message || "We couldn't delete this document.");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="page-container documents-page">
      <Link to="/profile" className="back-link"><ArrowLeft size={16} /> Back to profile</Link>
      <div className="documents-page-heading">
        <div>
          <span className="section-kicker">RESOURCE PROFILE</span>
          <h1>My documents</h1>
          <p>Manage the PDF documents associated with your resource profile.</p>
        </div>
        <button type="button" className="button button-primary" onClick={() => setUploadOpen(true)}>
          <Upload size={16} /> Upload document
        </button>
      </div>

      {error && <div className="documents-error documents-page-message">{error}</div>}
      {message && <div className="documents-success documents-page-message">{message}</div>}

      <section className="content-card documents-card">
        <div className="documents-card-heading">
          <div>
            <h2>Uploaded documents</h2>
            <p>{loading ? "Loading your files…" : `${documents.length} ${documents.length === 1 ? "document" : "documents"}`}</p>
          </div>
          {!loading && documents.length > 0 && <span className="documents-count">{documents.length}</span>}
        </div>

        {loading ? (
          <div className="documents-loading"><Loader2 size={20} className="documents-spin" /> Loading documents…</div>
        ) : documents.length === 0 ? (
          <div className="documents-empty">
            <div className="documents-empty-icon"><FileText size={25} /></div>
            <h3>No documents uploaded yet</h3>
            <p>Upload a PDF using the button above to keep your resource information and supporting documents in one place.</p>
          </div>
        ) : (
          <div className="documents-table-wrap">
            <table className="documents-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Created</th>
                  <th>Last updated</th>
                  <th className="documents-actions-heading">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.object_id}>
                    <td>
                      <div className="documents-name-cell">
                        <span className="documents-pdf-icon"><FileText size={18} /></span>
                        <strong title={document.original_file_name}>{document.original_file_name || "Untitled.pdf"}</strong>
                      </div>
                    </td>
                    <td><span className="documents-type">PDF</span></td>
                    <td>{formatSize(document.size_bytes)}</td>
                    <td>{formatDate(document.created_at_unix)}</td>
                    <td>{formatDate(document.updated_at_unix)}</td>
                    <td>
                      <div className="documents-row-actions">
                        <button type="button" className="documents-action-view" onClick={() => viewDocument(document)} disabled={Boolean(viewingId || deletingId)} title="View document">
                          {viewingId === document.object_id ? <Loader2 size={15} className="documents-spin" /> : <Eye size={15} />}
                          <span>View</span>
                        </button>
                        <button type="button" className="documents-action-delete" onClick={() => deleteDocument(document)} disabled={Boolean(viewingId || deletingId)} title="Delete document">
                          {deletingId === document.object_id ? <Loader2 size={15} className="documents-spin" /> : <Trash2 size={15} />}
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {uploadOpen && <DocumentUploadModal onClose={() => setUploadOpen(false)} onUploaded={async () => {
        await loadDocuments();
        setMessage("Document uploaded.");
      }} />}
    </div>
  );
}
