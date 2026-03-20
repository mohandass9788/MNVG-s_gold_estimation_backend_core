const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, 'views');
const filesToProcess = ['dashboard.ejs', 'admins.ejs', 'customers.ejs', 'shop-details.ejs', 'admin-config.ejs'];

filesToProcess.forEach(file => {
    const filePath = path.join(viewsDir, file);
    if (!fs.existsSync(filePath)) {
        console.log(`Skipping ${file}, not found.`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Sidebar transformation (add absolute + transform + id + z-index etc for mobile)
    content = content.replace(
        /<aside class="w-64 bg-gray-900 flex flex-col flex-shrink-0">/,
        `<aside id="sidebar" class="w-64 bg-gray-900 flex-col flex-shrink-0 fixed inset-y-0 left-0 transform -translate-x-full md:relative md:translate-x-0 transition-transform duration-200 ease-in-out z-50 flex">`
    );

    // 2. Add App Config to Nav
    if (!content.includes('App Config')) {
        const adminConfigLink = `
            <% if (admin.role === 'super_admin') { %>
            <a href="/admin/config" class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 text-sm font-medium transition">
                <span>⚙️</span> App Config
            </a>
            <% } %>`;
        content = content.replace(/<\/nav>/, `${adminConfigLink}\n        </nav>`);
    }

    // 3. Header transformation (add Hamburger menu)
    // Usually it looks like: <header class="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0">
    const headerRegex = /<header class="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-[0-9]+ flex-shrink-0">/;
    if (headerRegex.test(content) && !content.includes('toggleSidebar()')) {
        content = content.replace(
            headerRegex,
            `$&
            <div class="flex items-center gap-3">
                <button onclick="toggleSidebar()" class="md:hidden text-gray-600 text-2xl px-2">☰</button>`
        );
        // Find the first </h2> after the header and close the div
        content = content.replace(
            /(<h2 class="[^"]+">.*?<\/h2>)/,
            `$1\n            </div>`
        );
    }

    // 4. Add backdrop block before <aside>
    if (!content.includes('sidebar-backdrop')) {
        content = content.replace(
            /<aside id="sidebar"/,
            `<!-- ── MOBILE BACKDROP ── -->\n    <div id="sidebar-backdrop" onclick="toggleSidebar()" class="fixed inset-0 bg-black/50 z-40 hidden md:hidden"></div>\n\n    <aside id="sidebar"`
        );
    }

    // 5. Add toggleSidebar script
    if (!content.includes('function toggleSidebar()')) {
        content = content.replace(
            /<\/script>\n<\/body>/,
            `    function toggleSidebar() {
            document.getElementById('sidebar').classList.toggle('-translate-x-full');
            document.getElementById('sidebar-backdrop').classList.toggle('hidden');
        }
    </script>
</body>`
        );
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Processed ${file}`);
});
