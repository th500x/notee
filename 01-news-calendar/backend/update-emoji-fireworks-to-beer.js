import { getDatabase } from './database.js'

async function updateFireworksToBeer() {
  const db = getDatabase()
  
  console.log('=== Updating 🎆 to 🍺 in database ===')
  
  // First, check how many 🎆 reactions exist
  const checkQuery = 'SELECT COUNT(*) as count FROM emoji_reactions WHERE emoji = ?'
  
  db.get(checkQuery, ['🎆'], (err, row) => {
    if (err) {
      console.error('Check query failed:', err.message)
      return
    }
    
    const fireworksCount = row.count
    console.log(`Found ${fireworksCount} 🎆 reactions to update`)
    
    if (fireworksCount === 0) {
      console.log('No 🎆 reactions found, nothing to update')
      process.exit(0)
      return
    }
    
    // Update all 🎆 to 🍺
    const updateQuery = 'UPDATE emoji_reactions SET emoji = ? WHERE emoji = ?'
    
    db.run(updateQuery, ['🍺', '🎆'], function(updateErr) {
      if (updateErr) {
        console.error('Update failed:', updateErr.message)
        process.exit(1)
        return
      }
      
      console.log(`✅ Successfully updated ${this.changes} reactions from 🎆 to 🍺`)
      
      // Verify the update
      const verifyQuery = `
        SELECT emoji, COUNT(*) as count 
        FROM emoji_reactions 
        GROUP BY emoji 
        ORDER BY emoji
      `
      
      db.all(verifyQuery, [], (verifyErr, rows) => {
        if (verifyErr) {
          console.error('Verify query failed:', verifyErr.message)
        } else {
          console.log('\n=== Updated emoji distribution ===')
          rows.forEach(row => {
            console.log(`${row.emoji}: ${row.count} reactions`)
          })
        }
        
        process.exit(0)
      })
    })
  })
}

// Run update
updateFireworksToBeer()