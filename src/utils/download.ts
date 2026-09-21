import { formatStaffNoteDate, formatSafeDateTime } from './date';

export async function downloadAuthenticatedFile(
  url: string,
  token: string,
  fallbackFilename: string
): Promise<void> {
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Your admin session may have expired. Please log in again.');
      }
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.message || `Download failed with status ${res.status}`);
    }

    let filename = fallbackFilename;
    const disposition = res.headers.get('content-disposition');
    if (disposition) {
      if (disposition.includes("filename*=UTF-8''")) {
        const parts = disposition.split("filename*=UTF-8''");
        if (parts[1]) {
          const rawName = parts[1].split(';')[0].trim();
          try {
            filename = decodeURIComponent(rawName);
          } catch {
            filename = rawName;
          }
        }
      } else if (disposition.includes('filename=')) {
        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
          filename = match[1].replace(/['"]/g, '').trim();
        }
      }
    }

    const blob = await res.blob();
    if (blob.size === 0) {
      throw new Error('Received an empty file from the server.');
    }

    const objectUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
  } catch (err: any) {
    console.error('Download error:', err);
    alert(`Download All failed: ${err.message || "We couldn't prepare the requested file. Please try again."}`);
  }
}

export async function fetchAuthenticatedBlobUrl(
  url: string,
  token: string
): Promise<string> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Your admin session may have expired. Please log in again.');
    }
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to load file (status ${res.status})`);
  }

  const blob = await res.blob();
  return window.URL.createObjectURL(blob);
}

export async function printJobTicket(requestId: string, token: string): Promise<void> {
  try {
    const res = await fetch(`/api/admin/requests/${requestId}/ticket`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Your admin session may have expired. Please log in again.');
      }
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to load job ticket');
    }

    const ticket = await res.json();

    const win = window.open('', '_blank', 'width=800,height=900,menubar=no,toolbar=no,location=no,status=no');
    if (!win) {
      alert('Pop-up blocked. Please allow pop-ups for this site to print job tickets.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Job Ticket - ${ticket.referenceCode}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 32px; color: #0f172a; max-width: 700px; margin: 0 auto; }
            h1 { font-size: 22px; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center; }
            .shop { font-size: 14px; color: #64748b; font-weight: 500; margin-bottom: 24px; }
            .section { margin-bottom: 20px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; }
            .section h3 { margin-top: 0; font-size: 14px; text-transform: uppercase; color: #475569; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
            .label { font-weight: 600; color: #64748b; }
            .value { font-weight: 700; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
            th { background: #e2e8f0; font-weight: 700; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; background: #e0f2fe; color: #0369a1; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div>
            <h1><span>Job Ticket</span> <span style="font-family: monospace; color: #0284c7;">#${ticket.referenceCode}</span></h1>
            <div class="shop">${ticket.shopName} • Date: ${formatSafeDateTime(ticket.date)}</div>

            <div class="section">
              <h3>Customer Information</h3>
              <div class="row"><span class="label">Name:</span> <span class="value">${ticket.customerName}</span></div>
              <div class="row"><span class="label">Phone:</span> <span class="value">${ticket.customerPhone}</span></div>
              <div class="row"><span class="label">Request Type:</span> <span class="value">${ticket.type === 'quick' ? 'Walk-in (Quick Upload)' : 'Remote Upload'}</span></div>
              <div class="row"><span class="label">Status:</span> <span class="value"><span class="badge">${ticket.status.toUpperCase()}</span></span></div>
            </div>

            ${ticket.printOptions ? `
            <div class="section">
              <h3>Global Print Specifications</h3>
              <div class="row"><span class="label">Paper Size:</span> <span class="value">${ticket.printOptions.paperSize}</span></div>
              <div class="row"><span class="label">Color Mode:</span> <span class="value">${ticket.printOptions.colorMode}</span></div>
              <div class="row"><span class="label">Sides:</span> <span class="value">${ticket.printOptions.sides}</span></div>
              <div class="row"><span class="label">Copies:</span> <span class="value">${ticket.printOptions.copies}</span></div>
              <div class="row"><span class="label">Finishing:</span> <span class="value">${ticket.printOptions.finishing}</span></div>
            </div>
            ` : ''}

            ${ticket.instructions ? `
            <div class="section">
              <h3>Customer Instructions</h3>
              <p style="margin: 0; font-size: 13px; white-space: pre-wrap;">${ticket.instructions}</p>
            </div>
            ` : ''}

            <div class="section">
              <h3>Attached Files (${ticket.files.length})</h3>
              <table>
                <thead>
                  <tr><th>File Name</th><th>Size</th><th>MIME Type</th></tr>
                </thead>
                <tbody>
                  ${ticket.files.map((f: any) => `
                    <tr>
                      <td><strong>${f.name}</strong></td>
                      <td>${(f.size / (1024 * 1024)).toFixed(2)} MB</td>
                      <td>${f.mimeType || 'Unknown'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            ${ticket.internalNotes && ticket.internalNotes.length > 0 ? `
            <div class="section">
              <h3>Internal Staff Notes</h3>
              ${ticket.internalNotes.map((n: any) => `
                <div style="margin-bottom: 8px; font-size: 12px; border-left: 3px solid #0284c7; padding-left: 8px;">
                  <strong>${n.author || 'Staff Operator'}</strong> (${formatStaffNoteDate(n.createdAt)}): ${n.text}
                </div>
              `).join('')}
            </div>
            ` : ''}

            <div style="margin-top: 32px; text-align: center;" class="no-print">
              <button onclick="window.print()" style="background: #0284c7; color: white; border: none; padding: 10px 20px; font-weight: bold; border-radius: 8px; cursor: pointer;">Print Ticket</button>
            </div>
          </div>
        </body>
      </html>
    `;

    win.document.open();
    win.document.write(html);
    win.document.close();
  } catch (err: any) {
    console.error('Job ticket error:', err);
    alert(`Failed to print job ticket: ${err.message || 'Please try again.'}`);
  }
}
