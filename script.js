/* 🚨 여기에 Firebase 설정 값을 넣으세요! */
const firebaseConfig = {
    apiKey: "AIzaSyD7va4fNbe_T4dyEDVmxg-IW_ccvrM1Zvw",
    authDomain: "ytubeclp.firebaseapp.com",
    projectId: "ytubeclp",
    storageBucket: "ytubeclp.firebasestorage.app",
    messagingSenderId: "81831868656",
    appId: "1:81831868656:web:6226c1e878b4483da2ea35",
    measurementId: "G-QYGLD5Q5RH"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const docRef = db.collection("myApp").doc("loopData");

let playerIndex = 0;
const loops = [];

/* 🌙 다크모드 토글 로직 */
let isDarkMode = false;
function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle("dark-mode", isDarkMode);
    document.getElementById("themeBtn").innerText = isDarkMode ? "라이트모드 ☀️" : "다크모드 🌙";
}

/* 🟢 정규식 수정됨 (라이브 및 쇼츠 주소 지원) */
function extractVideoId(url) {
    const patterns = [
        /youtu\.be\/([^?&]+)/,
        /v=([^&]+)/,
        /embed\/([^?&]+)/,
        /\/live\/([^?&]+)/,
        /\/shorts\/([^?&]+)/			
    ];
    for (const p of patterns) {
        const match = url.match(p);
        if (match) return match[1];
    }
    return null;
}

/* 🟢 저장 시 메모(memo) 필드 추가 및 1MB 용량 사전 체크 (배치 순서 보존) */
async function saveLoops() {
    const data = [];
    
    /* 화면에 배치된 DOM 순서대로 데이터를 모아서 저장 (복제 시 위치 유지) */
    const videoNodes = document.getElementById("videos").children;
    for (let i = 0; i < videoNodes.length; i++) {
        const idx = videoNodes[i].id.split('-')[1]; /* wrapper-1 에서 '1' 추출 */
        const loop = loops[idx];
        if (!loop) continue;
        
        data.push({
            videoId: loop.videoId,
            start: loop.start,
            end: loop.end,
            title: loop.title,
            memo: loop.memo || ""
        });
    }

    const jsonString = JSON.stringify({ ytLoops: data });
    const byteLength = new Blob([jsonString]).size; 
    const maxBytes = 1024 * 1024; 

    if (byteLength > maxBytes) {
        alert(`⚠️ 저장 용량(1MB)을 초과했습니다! 현재 크기: ${(byteLength / 1024).toFixed(1)}KB\n메모를 줄이거나 오래된 영상을 삭제한 후 다시 시도해 주세요. 데이터가 저장되지 않았습니다.`);
        return; 
    }

    try {
        await docRef.set({ ytLoops: data });
    } catch (error) {
        console.error("저장 실패:", error);
    }
}

/* 🟢 불러올 때 자동재생을 막기 위해 맨 뒤에 false를 전달합니다. */
async function loadLoops() {
    try {
        const docSnap = await docRef.get();
        if (!docSnap.exists) return;

        const data = docSnap.data().ytLoops || [];
        for (const item of data) {
            await createLoopFromData(
                item.videoId,
                item.start,
                item.end,
                item.title,
                item.memo,
                null,
                false /* ❌ 웹사이트 최초 진입 시 자동 재생 방지 */
            );
        }
    } catch (error) {
        console.error("불러오기 실패:", error);
    }
}

/* 🟢 사용자가 직접 생성할 때는 즉시 편리하게 볼 수 있도록 맨 뒤에 true를 전달합니다. */
async function createLoop() {
    const url = document.getElementById("url").value.trim();
    const start = Number(document.getElementById("start").value);
    const end = Number(document.getElementById("end").value);

    if (!url || end <= start) {
        alert("입력값 확인 (종료초가 시작초보다 커야 합니다)");
        return;
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
        alert("영상 ID 추출 실패");
        return;
    }

    await createLoopFromData(videoId, start, end, null, "", null, true); /* ⭕ 즉시 재생 켜기 */
    saveLoops();

    document.getElementById("url").value = "";
    document.getElementById("start").value = "";
    document.getElementById("end").value = "";
}

/* 🟢 매개변수 맨 끝에 shouldAutoplay = false (기본값)를 추가했습니다. */
async function createLoopFromData(videoId, start, end, savedTitle = null, memo = "", insertAfterNode = null, shouldAutoplay = false) {
    let title = savedTitle || videoId;

    if (!savedTitle) {
        try {
            const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
            const data = await res.json();
            title = data.title;
        } catch {}
    }

    const idx = playerIndex++;
    const wrapper = document.createElement("div");
    wrapper.className = "video-item";
    wrapper.id = `wrapper-${idx}`;

    wrapper.innerHTML = `
        <div class="header">
            <span id="title-${idx}"><b>${title}</b> (${start}~${end}초)</span>
            <div class="header-buttons">
                <button onclick="duplicateLoop(${idx})">복제</button>
                <button onclick="editLoop(${idx})">시간 수정</button>
                <button onclick="removeLoop(${idx})">삭제</button>
            </div>
        </div>

        <div class="video-body">
            <div class="player-container">
                <div id="player-${idx}" class="player"></div>
            </div>
            <div class="memo-container">
                <textarea id="memo-${idx}" placeholder="여기에 메모를 작성하세요... (작성 후 다른 곳을 클릭하면 자동 저장됩니다)" onchange="updateMemo(${idx})">${memo}</textarea>
            </div>
        </div>
    `;

    const videosContainer = document.getElementById("videos");
    if (insertAfterNode) {
        videosContainer.insertBefore(wrapper, insertAfterNode.nextSibling);
    } else {
        videosContainer.appendChild(wrapper);
    }

    loops[idx] = {
        videoId,
        start,
        end,
        title,
        memo,
        player: null,
        interval: null
    };

    createPlayer(idx, videoId, shouldAutoplay); /* 🟢 판단 유무를 플레이어 생성기로 전달 */
}

/* 🟢 플레이어 생성 (자동재생 제어, 포커스 렉 방지 쿨다운, 글로벌 볼륨 동기화 결합) */
function createPlayer(idx, videoId, shouldAutoplay = false) {
    const loop = loops[idx];
    let lastSeekTime = 0; /* ⏱️ 구간 반복 팅김(10초 렉) 방지용 타임스탬프 */
    let lastPlayerVolume = -1; /* 🔊 해당 플레이어의 직전 볼륨 상태 기록용 */

    loop.player = new YT.Player(`player-${idx}`, {
        videoId: videoId,
        playerVars: {
            autoplay: shouldAutoplay ? 1 : 0, /* 👈 진입 시 0(정지), 수동 생성/복제 시 1(재생) */
            start: loop.start
        },
        events: {
            onReady(event) {
                /* 💾 이전에 저장된 글로벌 볼륨 크기가 있다면 가져와서 적용 */
                const savedVolume = localStorage.getItem("globalYtVolume");
                if (savedVolume !== null) {
                    event.target.setVolume(Number(savedVolume));
                }
                
                /* 최초 볼륨 상태 기록 */
                lastPlayerVolume = event.target.getVolume();

                if (shouldAutoplay) {
                    event.target.playVideo(); /* 👈 사용자가 방금 요청한 것만 재생 명령 실행 */
                }
                
                loop.interval = setInterval(() => {
                    try {
                        /* 🔊 실시간 볼륨 변경 감지 시스템 */
                        const currentVolume = event.target.getVolume();
                        if (currentVolume !== lastPlayerVolume) {
                            lastPlayerVolume = currentVolume;
                            localStorage.setItem("globalYtVolume", currentVolume);
                            
                            /* 🔄 현재 조절한 볼륨을 생성되어 있는 다른 모든 플레이어에게도 전파 */
                            loops.forEach((l, i) => {
                                if (l && l.player && typeof l.player.setVolume === "function" && i !== idx) {
                                    l.player.setVolume(currentVolume);
                                }
                            });
                        }

                        /* 🔄 구간 반복 감시: '재생 중(1)' 상태가 되었을 때만 감시 작동 */
                        if (event.target.getPlayerState() === 1) { 
                            const current = event.target.getCurrentTime();
                            const now = Date.now();
                            
                            /* ⏱️ 0.8초 쿨다운 시스템: 순간적인 뒤로가기 무한 연타 렉 원천 차단 */
                            if (now - lastSeekTime < 800) return; 

                            if (current >= loop.end || current < loop.start - 0.5) {
                                lastSeekTime = now; 
                                event.target.seekTo(loop.start, true);
                            }
                        }
                    } catch {}
                }, 100);
            }
        }
    });
}

/* 🟢 새로운 기능: 시간 수정 */
function editLoop(idx) {
    const loop = loops[idx];
    if (!loop) return;

    const newStart = prompt("새로운 시작 시간(초)을 입력하세요:", loop.start);
    if (newStart === null) return; 
    
    const newEnd = prompt("새로운 종료 시간(초)을 입력하세요:", loop.end);
    if (newEnd === null) return; 

    const startNum = Number(newStart);
    const endNum = Number(newEnd);

    if (isNaN(startNum) || isNaN(endNum) || startNum >= endNum) {
        alert("올바른 숫자를 입력해주세요 (시작초 < 종료초).");
        return;
    }

    loop.start = startNum;
    loop.end = endNum;

    document.getElementById(`title-${idx}`).innerHTML = `<b>${loop.title}</b> (${loop.start}~${loop.end}초)`;

    if (loop.player && loop.player.seekTo) {
        loop.player.seekTo(loop.start, true);
    }

    saveLoops();
}

/* 🟢 새로운 기능: 메모 내용 저장 (입력칸을 벗어날 때 실행됨) */
function updateMemo(idx) {
    const loop = loops[idx];
    if (!loop) return;
    
    const memoText = document.getElementById(`memo-${idx}`).value;
    loop.memo = memoText;
    
    saveLoops();
}

/* 🟢 복제할 때도 즉시 확인하기 편하도록 true를 넘겨 바로 재생되도록 합니다. */
async function duplicateLoop(idx) {
    const loop = loops[idx];
    if (!loop) return;

    const currentNode = document.getElementById(`wrapper-${idx}`);
    
    await createLoopFromData(
        loop.videoId,
        loop.start,
        loop.end,
        loop.title,
        loop.memo, 
        currentNode,
        true /* ⭕ 복제된 항목은 즉시 재생 시작 */
    );

    saveLoops();
}

function removeLoop(idx) {
    if (!confirm("정말 삭제할까?")) return;
    
    const loop = loops[idx];
    if (!loop) return;

    clearInterval(loop.interval);
    if (loop.player) loop.player.destroy();

    document.getElementById(`wrapper-${idx}`)?.remove();
    delete loops[idx];

    saveLoops();
}

function clearAll() {
    if (!confirm("저장된 모든 영상을 삭제할까?")) return;
    
    for (const loop of loops) {
        if (!loop) continue;
        clearInterval(loop.interval);
        if (loop.player) loop.player.destroy();
    }

    document.getElementById("videos").innerHTML = "";
    loops.length = 0;

    saveLoops();
}

window.addEventListener("load", async () => {
    await loadLoops();
});
