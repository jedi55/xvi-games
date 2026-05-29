import { renderAdminSidebar, showToast } from '../../components/layout.js';

export async function renderAdminTables(app) {
  // Fetch tables from Supabase
  const { supabase } = await import('../../lib/supabase.js')
  
  const { data: tables, error } = await supabase
    .from('snooker_tables')
    .select('*')
    .order('table_number', { ascending: true })

  const renderPage = (tableList) => {
    app.innerHTML = `
      <div class="admin-layout">
        ${renderAdminSidebar('tables')}
        <main class="admin-main">
          
          <header style="margin-bottom:2rem;display:flex;
            justify-content:space-between;align-items:flex-end;">
            <div>
              <p class="label-xs text-primary" 
                style="margin-bottom:0.5rem;letter-spacing:0.2em;">
                TABLE MANAGEMENT
              </p>
              <h1 class="headline-md" style="font-size:2rem;">
                Manage Tables
              </h1>
              <p style="color:var(--outline);font-size:0.85rem;
                margin-top:0.25rem;">
                Changes reflect instantly on the booking site
              </p>
            </div>
            <button id="add-table-btn" 
              class="btn btn-primary"
              style="display:flex;align-items:center;gap:0.5rem;">
              <span class="material-symbols-outlined" 
                style="font-size:1rem;">add</span>
              Add New Table
            </button>
          </header>

          <!-- Tables Grid -->
          <div id="tables-grid" style="display:grid;
            grid-template-columns:repeat(auto-fill,minmax(300px,1fr));
            gap:1.5rem;margin-bottom:2rem;">
            ${tableList.map(table => `
              <div class="table-mgmt-card" 
                data-id="${table.id}"
                style="background:var(--surface);
                  border:1px solid var(--outline-variant);
                  border-radius:12px;padding:1.5rem;
                  position:relative;">
                
                <!-- Status Badge -->
                <div style="position:absolute;top:1rem;right:1rem;">
                  <span style="
                    background:${table.is_active ? 
                      'rgba(46,125,50,0.2)' : 'rgba(239,68,68,0.15)'};
                    color:${table.is_active ? '#4caf50' : '#ef4444'};
                    padding:0.25rem 0.75rem;border-radius:20px;
                    font-size:0.75rem;font-weight:600;">
                    ${table.is_active ? '● Active' : '● Inactive'}
                  </span>
                </div>

                <!-- Table Icon -->
                <div style="font-size:2rem;margin-bottom:1rem;">
                  ${table.label.includes('VIP') ? '👑' : '🎱'}
                </div>

                <!-- Table Info -->
                <h3 style="color:var(--on-surface);font-size:1.1rem;
                  font-weight:600;margin:0 0 0.25rem;">
                  ${table.label}
                </h3>
                <p style="color:var(--outline);font-size:0.8rem;
                  margin:0 0 1rem;">
                  Table #${table.table_number}
                </p>

                <!-- Pricing -->
                <div style="display:grid;grid-template-columns:1fr 1fr;
                  gap:0.75rem;margin-bottom:1.25rem;">
                  <div style="background:var(--background);
                    border-radius:8px;padding:0.75rem;text-align:center;">
                    <p style="color:var(--outline);font-size:0.7rem;
                      margin:0 0 0.25rem;text-transform:uppercase;
                      letter-spacing:1px;">Per Hour</p>
                    <p style="color:var(--primary);font-size:1rem;
                      font-weight:700;margin:0;">
                      ₦${(table.hourly_rate/100).toLocaleString()}
                    </p>
                  </div>
                  <div style="background:var(--background);
                    border-radius:8px;padding:0.75rem;text-align:center;">
                    <p style="color:var(--outline);font-size:0.7rem;
                      margin:0 0 0.25rem;text-transform:uppercase;
                      letter-spacing:1px;">Per Game</p>
                    <p style="color:var(--primary);font-size:1rem;
                      font-weight:700;margin:0;">
                      ₦${(table.per_game_rate/100).toLocaleString()}
                    </p>
                  </div>
                </div>

                <!-- Action Buttons -->
                <div style="display:flex;gap:0.75rem;margin-bottom:0.75rem;">
                  <button class="edit-table-btn btn btn-secondary btn-sm"
                    data-id="${table.id}"
                    data-label="${table.label}"
                    data-number="${table.table_number}"
                    data-hourly="${table.hourly_rate}"
                    data-game="${table.per_game_rate}"
                    data-active="${table.is_active}"
                    style="flex:1;">
                    <span class="material-symbols-outlined" 
                      style="font-size:0.9rem;">edit</span>
                    Edit
                  </button>
                  <button class="toggle-table-btn btn btn-secondary btn-sm"
                    data-id="${table.id}"
                    data-active="${table.is_active}"
                    style="flex:1;">
                    ${table.is_active ? 
                      '<span class="material-symbols-outlined" style="font-size:0.9rem;">visibility_off</span> Deactivate' : 
                      '<span class="material-symbols-outlined" style="font-size:0.9rem;">visibility</span> Activate'}
                  </button>
                  <button class="delete-table-btn action-btn danger"
                    data-id="${table.id}"
                    data-label="${table.label}"
                    title="Delete table"
                    style="padding:0.5rem 0.75rem;">
                    <span class="material-symbols-outlined" 
                      style="font-size:1rem;">delete</span>
                  </button>
                </div>
                <button class="manual-book-btn btn btn-primary btn-sm"
                  data-id="${table.id}"
                  data-label="${table.label}"
                  style="width:100%;display:flex;justify-content:center;align-items:center;gap:0.5rem;">
                  <span class="material-symbols-outlined" style="font-size:1rem;">calendar_month</span>
                  Manual Book
                </button>
              </div>
            `).join('')}
          </div>

          <!-- Live Preview Note -->
          <div style="background:rgba(46,125,50,0.1);
            border:1px solid rgba(46,125,50,0.3);
            border-radius:8px;padding:1rem 1.25rem;
            display:flex;align-items:center;gap:0.75rem;">
            <span class="material-symbols-outlined" 
              style="color:#4caf50;">sync</span>
            <p style="margin:0;color:var(--on-surface);
              font-size:0.85rem;">
              <strong>Live sync enabled.</strong> 
              Any changes you make here will 
              instantly update the booking site 
              and table availability for customers.
            </p>
          </div>

        </main>
      </div>

      <!-- Edit/Add Modal (hidden by default) -->
      <div id="table-modal" style="display:none;position:fixed;
        top:0;left:0;width:100%;height:100%;
        background:rgba(0,0,0,0.8);z-index:9999;
        align-items:center;justify-content:center;">
        <div style="background:var(--surface);border-radius:16px;
          width:90%;max-width:480px;padding:2rem;
          border:1px solid var(--outline-variant);
          max-height:90vh;overflow-y:auto;">
          
          <div style="display:flex;justify-content:space-between;
            align-items:center;margin-bottom:1.5rem;">
            <h2 id="modal-title" style="margin:0;font-size:1.25rem;
              color:var(--on-surface);">Edit Table</h2>
            <button id="close-modal-btn" style="background:transparent;
              border:none;color:var(--outline);font-size:1.25rem;
              cursor:pointer;">✕</button>
          </div>

          <form id="table-form">
            <input type="hidden" id="form-table-id"/>
            
            <div style="margin-bottom:1rem;">
              <label style="display:block;color:var(--outline);
                font-size:0.8rem;margin-bottom:0.4rem;
                text-transform:uppercase;letter-spacing:1px;">
                Table Name / Label *
              </label>
              <input type="text" id="form-label"
                placeholder="e.g. Table 1 or VIP Table"
                required
                style="width:100%;padding:0.75rem;
                  background:var(--background);
                  border:1px solid var(--outline-variant);
                  border-radius:8px;color:var(--on-surface);
                  font-size:0.95rem;box-sizing:border-box;"/>
            </div>

            <div style="margin-bottom:1rem;">
              <label style="display:block;color:var(--outline);
                font-size:0.8rem;margin-bottom:0.4rem;
                text-transform:uppercase;letter-spacing:1px;">
                Table Number *
              </label>
              <input type="number" id="form-number"
                placeholder="e.g. 5"
                min="1" max="99" required
                style="width:100%;padding:0.75rem;
                  background:var(--background);
                  border:1px solid var(--outline-variant);
                  border-radius:8px;color:var(--on-surface);
                  font-size:0.95rem;box-sizing:border-box;"/>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;
              gap:1rem;margin-bottom:1rem;">
              <div>
                <label style="display:block;color:var(--outline);
                  font-size:0.8rem;margin-bottom:0.4rem;
                  text-transform:uppercase;letter-spacing:1px;">
                  Hourly Rate (₦) *
                </label>
                <input type="number" id="form-hourly"
                  placeholder="e.g. 1500"
                  min="100" required
                  style="width:100%;padding:0.75rem;
                    background:var(--background);
                    border:1px solid var(--outline-variant);
                    border-radius:8px;color:var(--on-surface);
                    font-size:0.95rem;box-sizing:border-box;"/>
                <p style="color:var(--outline);font-size:0.7rem;
                  margin:0.25rem 0 0;">Enter amount in Naira</p>
              </div>
              <div>
                <label style="display:block;color:var(--outline);
                  font-size:0.8rem;margin-bottom:0.4rem;
                  text-transform:uppercase;letter-spacing:1px;">
                  Per Game Rate (₦) *
                </label>
                <input type="number" id="form-game"
                  placeholder="e.g. 800"
                  min="100" required
                  style="width:100%;padding:0.75rem;
                    background:var(--background);
                    border:1px solid var(--outline-variant);
                    border-radius:8px;color:var(--on-surface);
                    font-size:0.95rem;box-sizing:border-box;"/>
                <p style="color:var(--outline);font-size:0.7rem;
                  margin:0.25rem 0 0;">Enter amount in Naira</p>
              </div>
            </div>

            <div style="margin-bottom:1.5rem;">
              <label style="display:flex;align-items:center;
                gap:0.75rem;cursor:pointer;">
                <input type="checkbox" id="form-active" 
                  checked
                  style="width:18px;height:18px;cursor:pointer;
                    accent-color:#1a5c1a;"/>
                <span style="color:var(--on-surface);font-size:0.9rem;">
                  Table is active and available for booking
                </span>
              </label>
            </div>

            <div style="display:flex;gap:0.75rem;">
              <button type="submit" id="save-table-btn"
                class="btn btn-primary"
                style="flex:1;padding:0.875rem;">
                Save Changes
              </button>
              <button type="button" id="cancel-modal-btn"
                class="btn btn-secondary"
                style="flex:1;padding:0.875rem;">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Manual Book Modal -->
      <div id="manual-book-modal" style="display:none;position:fixed;
        top:0;left:0;width:100%;height:100%;
        background:rgba(0,0,0,0.8);z-index:9999;
        align-items:center;justify-content:center;">
        <div style="background:var(--surface);border-radius:16px;
          width:90%;max-width:400px;padding:2rem;
          border:1px solid var(--outline-variant);
          max-height:90vh;overflow-y:auto;">
          
          <div style="display:flex;justify-content:space-between;
            align-items:center;margin-bottom:1.5rem;">
            <h2 style="margin:0;font-size:1.25rem;color:var(--on-surface);">Manual Booking</h2>
            <button id="close-manual-btn" style="background:transparent;
              border:none;color:var(--outline);font-size:1.25rem;
              cursor:pointer;">✕</button>
          </div>

          <p id="manual-book-subtitle" style="color:var(--primary);font-weight:600;margin-top:0;margin-bottom:1.5rem;"></p>

          <form id="manual-book-form">
            <input type="hidden" id="manual-table-id" />
            
            <div style="margin-bottom:1rem;">
              <label style="display:block;color:var(--outline);font-size:0.8rem;margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:1px;">Date *</label>
              <input type="date" id="manual-date" required
                style="width:100%;padding:0.75rem;background:var(--background);
                  border:1px solid var(--outline-variant);border-radius:8px;
                  color:var(--on-surface);font-size:0.95rem;box-sizing:border-box;"/>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
              <div>
                <label style="display:block;color:var(--outline);font-size:0.8rem;margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:1px;">Start Time *</label>
                <input type="time" id="manual-start" required
                  style="width:100%;padding:0.75rem;background:var(--background);
                    border:1px solid var(--outline-variant);border-radius:8px;
                    color:var(--on-surface);font-size:0.95rem;box-sizing:border-box;"/>
              </div>
              <div>
                <label style="display:block;color:var(--outline);font-size:0.8rem;margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:1px;">End Time *</label>
                <input type="time" id="manual-end" required
                  style="width:100%;padding:0.75rem;background:var(--background);
                    border:1px solid var(--outline-variant);border-radius:8px;
                    color:var(--on-surface);font-size:0.95rem;box-sizing:border-box;"/>
              </div>
            </div>

            <div style="margin-bottom:1rem;">
              <label style="display:block;color:var(--outline);font-size:0.8rem;margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:1px;">Customer Name (Optional)</label>
              <input type="text" id="manual-name" placeholder="Walk-in Customer"
                style="width:100%;padding:0.75rem;background:var(--background);
                  border:1px solid var(--outline-variant);border-radius:8px;
                  color:var(--on-surface);font-size:0.95rem;box-sizing:border-box;"/>
            </div>

            <div style="margin-bottom:1.5rem;">
              <label style="display:block;color:var(--outline);font-size:0.8rem;margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:1px;">Notes (Optional)</label>
              <input type="text" id="manual-notes" placeholder="e.g. Paid in cash"
                style="width:100%;padding:0.75rem;background:var(--background);
                  border:1px solid var(--outline-variant);border-radius:8px;
                  color:var(--on-surface);font-size:0.95rem;box-sizing:border-box;"/>
            </div>

            <div style="display:flex;gap:0.75rem;">
              <button type="submit" id="save-manual-btn" class="btn btn-primary" style="flex:1;padding:0.875rem;">Block This Table</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div id="delete-modal" style="display:none;position:fixed;
        top:0;left:0;width:100%;height:100%;
        background:rgba(0,0,0,0.8);z-index:9999;
        align-items:center;justify-content:center;">
        <div style="background:var(--surface);border-radius:16px;
          width:90%;max-width:400px;padding:2rem;text-align:center;
          border:1px solid rgba(239,68,68,0.3);">
          <div style="font-size:2.5rem;margin-bottom:1rem;">⚠️</div>
          <h3 style="color:var(--on-surface);margin:0 0 0.75rem;">
            Delete Table?
          </h3>
          <p id="delete-message" style="color:var(--outline);
            font-size:0.9rem;margin:0 0 1.5rem;line-height:1.5;">
            This will permanently delete this table.
            Existing bookings will not be affected.
          </p>
          <div style="display:flex;gap:0.75rem;">
            <button id="confirm-delete-btn"
              style="flex:1;padding:0.875rem;background:#ef4444;
                color:white;border:none;border-radius:8px;
                font-size:0.95rem;font-weight:600;cursor:pointer;">
              Yes, Delete Table
            </button>
            <button id="cancel-delete-btn"
              class="btn btn-secondary"
              style="flex:1;padding:0.875rem;">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `
    setupTableHandlers(supabase, renderPage)
  }

  renderPage(tables || [])
}

function setupTableHandlers(supabase, renderPage) {
  const modal = document.getElementById('table-modal')
  const deleteModal = document.getElementById('delete-modal')
  
  // ── ADD NEW TABLE ──────────────────────────────────
  document.getElementById('add-table-btn')
    ?.addEventListener('click', () => {
      document.getElementById('modal-title').textContent = 
        'Add New Table'
      document.getElementById('form-table-id').value = ''
      document.getElementById('form-label').value = ''
      document.getElementById('form-number').value = ''
      document.getElementById('form-hourly').value = ''
      document.getElementById('form-game').value = ''
      document.getElementById('form-active').checked = true
      modal.style.display = 'flex'
    })

  // ── EDIT TABLE ─────────────────────────────────────
  document.querySelectorAll('.edit-table-btn')
    .forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('modal-title').textContent = 
          'Edit Table'
        document.getElementById('form-table-id').value = 
          btn.dataset.id
        document.getElementById('form-label').value = 
          btn.dataset.label
        document.getElementById('form-number').value = 
          btn.dataset.number
        // Convert from kobo to naira for display
        document.getElementById('form-hourly').value = 
          parseInt(btn.dataset.hourly) / 100
        document.getElementById('form-game').value = 
          parseInt(btn.dataset.game) / 100
        document.getElementById('form-active').checked = 
          btn.dataset.active === 'true'
        modal.style.display = 'flex'
      })
    })

  // ── TOGGLE ACTIVE/INACTIVE ─────────────────────────
  document.querySelectorAll('.toggle-table-btn')
    .forEach(btn => {
      btn.addEventListener('click', async () => {
        const newActive = btn.dataset.active !== 'true'
        try {
          const { error } = await supabase
            .from('snooker_tables')
            .update({ is_active: newActive })
            .eq('id', btn.dataset.id)
          
          if (error) throw error
          
          showToast(
            newActive ? 'Table activated ✓' : 'Table deactivated'
          )
          // Refresh the page
          const { renderAdminTables } = 
            await import('./tables-mgmt.js')
          const app = document.getElementById('app') 
            || document.querySelector('.admin-layout')?.parentElement
          if (app) renderAdminTables(app)
        } catch (e) {
          showToast('Failed to update table', 'error')
        }
      })
    })

  // ── DELETE TABLE ───────────────────────────────────
  let tableToDelete = null
  document.querySelectorAll('.delete-table-btn')
    .forEach(btn => {
      btn.addEventListener('click', () => {
        tableToDelete = btn.dataset.id
        document.getElementById('delete-message').textContent = 
          `Are you sure you want to permanently delete 
          "${btn.dataset.label}"? 
          This cannot be undone. 
          Existing bookings will not be affected.`
        deleteModal.style.display = 'flex'
      })
    })

  document.getElementById('confirm-delete-btn')
    ?.addEventListener('click', async () => {
      if (!tableToDelete) return
      try {
        const { error } = await supabase
          .from('snooker_tables')
          .delete()
          .eq('id', tableToDelete)
        
        if (error) throw error
        
        deleteModal.style.display = 'none'
        showToast('Table deleted successfully')
        
        // Refresh
        const { renderAdminTables } = 
          await import('./tables-mgmt.js')
        const app = document.getElementById('app') 
          || document.querySelector('.admin-layout')?.parentElement
        if (app) renderAdminTables(app)
      } catch (e) {
        showToast('Failed to delete table', 'error')
      }
    })

  document.getElementById('cancel-delete-btn')
    ?.addEventListener('click', () => {
      deleteModal.style.display = 'none'
      tableToDelete = null
    })

  // ── SAVE TABLE (Add or Edit) ───────────────────────
  document.getElementById('table-form')
    ?.addEventListener('submit', async (e) => {
      e.preventDefault()
      
      const id = document.getElementById('form-table-id').value
      const label = document.getElementById('form-label').value.trim()
      const tableNumber = parseInt(
        document.getElementById('form-number').value
      )
      // Convert naira to kobo for storage
      const hourlyRate = Math.round(
        parseFloat(document.getElementById('form-hourly').value) * 100
      )
      const gameRate = Math.round(
        parseFloat(document.getElementById('form-game').value) * 100
      )
      const isActive = document.getElementById('form-active').checked

      const saveBtn = document.getElementById('save-table-btn')
      saveBtn.textContent = 'Saving...'
      saveBtn.disabled = true

      try {
        let error
        
        if (id) {
          // UPDATE existing table
          const result = await supabase
            .from('snooker_tables')
            .update({
              label,
              table_number: tableNumber,
              hourly_rate: hourlyRate,
              per_game_rate: gameRate,
              is_active: isActive
            })
            .eq('id', id)
          error = result.error
        } else {
          // INSERT new table
          const result = await supabase
            .from('snooker_tables')
            .insert({
              label,
              table_number: tableNumber,
              hourly_rate: hourlyRate,
              per_game_rate: gameRate,
              is_active: isActive
            })
          error = result.error
        }

        if (error) throw error

        modal.style.display = 'none'
        showToast(
          id ? 'Table updated! Changes are live ✓' 
             : 'New table added! It is now live ✓'
        )
        
        // Refresh the admin tables page
        const { renderAdminTables } = 
          await import('./tables-mgmt.js')
        const appEl = document.getElementById('app') 
          || document.querySelector('.admin-layout')?.parentElement
        if (appEl) renderAdminTables(appEl)

      } catch (err) {
        console.error('Save error:', err)
        showToast('Failed to save. Please try again.', 'error')
        saveBtn.textContent = 'Save Changes'
        saveBtn.disabled = false
      }
    })

  // ── MANUAL BOOKING ─────────────────────────────────
  const manualModal = document.getElementById('manual-book-modal')
  
  document.querySelectorAll('.manual-book-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('manual-table-id').value = btn.dataset.id
      document.getElementById('manual-book-subtitle').textContent = `Booking: ${btn.dataset.label}`
      
      const now = new Date()
      document.getElementById('manual-date').value = now.toISOString().split('T')[0]
      document.getElementById('manual-start').value = now.toTimeString().substring(0,5)
      now.setHours(now.getHours() + 1)
      document.getElementById('manual-end').value = now.toTimeString().substring(0,5)
      
      document.getElementById('manual-name').value = ''
      document.getElementById('manual-notes').value = ''
      
      manualModal.style.display = 'flex'
    })
  })

  document.getElementById('manual-book-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    
    const tableId = document.getElementById('manual-table-id').value
    const date = document.getElementById('manual-date').value
    const start = document.getElementById('manual-start').value + ':00'
    const end = document.getElementById('manual-end').value + ':00'
    const name = document.getElementById('manual-name').value.trim() || 'Walk-in Customer'
    
    const saveBtn = document.getElementById('save-manual-btn')
    saveBtn.textContent = 'Processing...'
    saveBtn.disabled = true

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      const { error } = await supabase
        .from('reservations')
        .insert({
          user_id: session?.user?.id || '00000000-0000-0000-0000-000000000000',
          table_id: tableId,
          booking_type: 'time',
          date: date,
          start_time: start,
          end_time: end,
          status: 'confirmed',
          total_amount: 0
        })

      if (error) throw error

      manualModal.style.display = 'none'
      showToast('Table manually booked ✓')
      saveBtn.textContent = 'Block This Table'
      saveBtn.disabled = false
    } catch (err) {
      console.error(err)
      showToast('Failed to create manual booking', 'error')
      saveBtn.textContent = 'Block This Table'
      saveBtn.disabled = false
    }
  })

  // ── CLOSE MODALS ───────────────────────────────────
  document.getElementById('close-modal-btn')
    ?.addEventListener('click', () => {
      modal.style.display = 'none'
    })
  document.getElementById('cancel-modal-btn')
    ?.addEventListener('click', () => {
      modal.style.display = 'none'
    })
    
  document.getElementById('close-manual-btn')
    ?.addEventListener('click', () => {
      manualModal.style.display = 'none'
    })
  
  // Close modal on backdrop click
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none'
  })
  deleteModal?.addEventListener('click', (e) => {
    if (e.target === deleteModal) 
      deleteModal.style.display = 'none'
  })
  manualModal?.addEventListener('click', (e) => {
    if (e.target === manualModal) 
      manualModal.style.display = 'none'
  })
}

