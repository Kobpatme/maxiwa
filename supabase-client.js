/* supabase-client.js */

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getDeposits() {
    const { data, error } = await _supabase
        .from('deposits')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error('Error fetching deposits:', error);
        return [];
    }
    return data;
}

async function insertDeposit(depositData) {
    const { data, error } = await _supabase
        .from('deposits')
        .insert([depositData])
        .select();

    if (error) {
        console.error('Error inserting deposit:', error);
        throw error;
    }
    return data[0];
}

async function updateDeposit(id, depositData) {
    const { data, error } = await _supabase
        .from('deposits')
        .update(depositData)
        .eq('id', id)
        .select();

    if (error) {
        console.error('Error updating deposit:', error);
        throw error;
    }
    return data[0];
}

async function deleteDeposit(id) {
    const { error } = await _supabase
        .from('deposits')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting deposit:', error);
        throw error;
    }
    return true;
}
