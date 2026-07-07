async function loadJson(url) {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) throw new Error("API unavailable");
  return response.json();
}

function renderPublicJobs(jobs) {
  const grid = document.getElementById("publicJobs");
  if (!grid || !jobs.length) return;
  grid.innerHTML = jobs.map((job, index) => `
    <article class="job-card${index === 0 ? " featured" : ""}">
      <div class="job-cover">${job.type.slice(0, 3).toUpperCase()}</div>
      <div class="job-content">
        <p class="job-type">${job.type}</p>
        <h3>${job.title}</h3>
        <p>${job.description}</p>
        <div class="job-tags">
          ${job.tags.map((tag) => `<span>${tag}</span>`).join("")}
        </div>
      </div>
    </article>
  `).join("");
}

function renderPublicNews(news) {
  const grid = document.getElementById("publicNews");
  if (!grid || !news.length) return;
  grid.innerHTML = news.map((item, index) => `
    <article class="news-card${item.featured || index === 0 ? " lead-news" : ""}">
      <span class="news-label">${item.category}</span>
      <h3>${item.title}</h3>
      <p>${item.excerpt}</p>
      <a href="news.html">Đọc thêm</a>
    </article>
  `).join("");
}

if (window.location.protocol !== "file:") {
  loadJson("/api/jobs").then((data) => renderPublicJobs(data.jobs || [])).catch(() => {});
  loadJson("/api/news").then((data) => renderPublicNews(data.news || [])).catch(() => {});
}
