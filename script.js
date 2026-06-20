
// 🚨 여기에 Firebase 설정 값을 넣으세요!
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

// 🌙 다크모드 토글 로직
let isDarkMode = false;
function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle("dark-mode", isDarkMode);
    document.getElementById("themeBtn").innerText = isDarkMode ? "라이트모드 ☀️" : "다크모드 🌙";
}

// 🟢 정규식 수정됨 (라이브 주소 지원)
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

// 🟢 저장 시 메모(memo) 필드 추가 및 1MB 용량 사전 체크 (배치 순서 보존)
async function saveLoops() {
    const data = [];
    
    // 화면에 배치된 DOM 순서대로 데이터를 모아서 저장 (복제 시 위치 유지)
    const videoNodes = document.getElementById("videos").children;
    for (let i = 0; i < videoNodes.length; i++) {
        const idx = videoNodes[i].id.split('-')[1]; // wrapper-1 에서 '1' 추출
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
	
	// 🔍 [추가] 데이터 용량 사전 체크 (1MB 제한)
    const jsonString = JSON.stringify({ ytLoops: data });
    const byteLength = new Blob([jsonString]).size; // 실제 바이트 크기 계산
    const maxBytes = 1024 * 1024; // 1MB = 1,048,576 Bytes

    if (byteLength > maxBytes) {
        alert(`⚠️ 저장 용량(1MB)을 초과했습니다! 현재 크기: ${(byteLength / 1024).toFixed(1)}KB\n메모를 줄이거나 오래된 영상을 삭제한 후 다시 시도해 주세요. 데이터가 저장되지 않았습니다.`);
        return; // Firestore 전송을 중단하고 함수 탈출
    }

    try {
        await docRef.set({ ytLoops: data });
    } catch (error) {
        console.error("저장 실패:", error);
    }
}

// 🟢 불러올 때 메모(memo) 데이터도 함께 전달
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
                item.memo
            );
        }
    } catch (error) {
        console.error("불러오기 실패:", error);
    }
}

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

    await createLoopFromData(videoId, start, end);
    saveLoops();

    document.getElementById("url").value = "";
    document.getElementById("start").value = "";
    document.getElementById("end").value = "";
}

// 🟢 생성 함수에 복제 버튼, 삽입 위치(insertAfterNode) 매개변수 추가
async function createLoopFromData(videoId, start, end, savedTitle = null, memo = "", insertAfterNode = null) {
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

    // 🟢 HTML 구조 변경 (복제 버튼 추가)
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

    // 🟢 지정된 위치(insertAfterNode) 바로 밑에 삽입, 없으면 맨 끝에 추가
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

    createPlayer(idx, videoId);
}

function createPlayer(idx, videoId) {
    const loop = loops[idx];

    loop.player = new YT.Player(`player-${idx}`, {
        videoId: videoId,
        playerVars: {
            autoplay: 1,
            start: loop.start
        },
        events: {
            onReady(event) {
                event.target.playVideo();
                loop.interval = setInterval(() => {
                    try {
                        const current = event.target.getCurrentTime();
                        // 🟢 수정된 시간을 바로 반영하기 위해 loop.end를 참조
                        if (current >= loop.end || current < loop.start) {
                            event.target.seekTo(loop.start, true);
                        }
                    } catch {}
                }, 100);
            }
        }
    });
}

// 🟢 새로운 기능: 시간 수정
function editLoop(idx) {
    const loop = loops[idx];
    if (!loop) return;

    const newStart = prompt("새로운 시작 시간(초)을 입력하세요:", loop.start);
    if (newStart === null) return; // 취소 누름
    
    const newEnd = prompt("새로운 종료 시간(초)을 입력하세요:", loop.end);
    if (newEnd === null) return; // 취소 누름

    const startNum = Number(newStart);
    const endNum = Number(newEnd);

    if (isNaN(startNum) || isNaN(endNum) || startNum >= endNum) {
        alert("올바른 숫자를 입력해주세요 (시작초 < 종료초).");
        return;
    }

    // 데이터 업데이트
    loop.start = startNum;
    loop.end = endNum;

    // 화면 텍스트 업데이트
    document.getElementById(`title-${idx}`).innerHTML = `<b>${loop.title}</b> (${loop.start}~${loop.end}초)`;

    // 영상 재생 위치 즉시 이동
    if (loop.player && loop.player.seekTo) {
        loop.player.seekTo(loop.start, true);
    }

    // DB 저장
    saveLoops();
}

// 🟢 새로운 기능: 메모 내용 저장 (입력칸을 벗어날 때 실행됨)
function updateMemo(idx) {
    const loop = loops[idx];
    if (!loop) return;
    
    const memoText = document.getElementById(`memo-${idx}`).value;
    loop.memo = memoText;
    
    saveLoops();
}

// 🟢 새로운 기능: 영상 및 메모 복제 (바로 밑에 생성)
async function duplicateLoop(idx) {
    const loop = loops[idx];
    if (!loop) return;

    // 현재 클릭한 영상의 DOM 요소를 찾아서 기준점으로 삼음
    const currentNode = document.getElementById(`wrapper-${idx}`);
    
    // 원본 데이터를 그대로 넘겨서 새로운 루프 생성
    await createLoopFromData(
        loop.videoId,
        loop.start,
        loop.end,
        loop.title,
        loop.memo, // 메모 내용도 그대로 복제
        currentNode // 이 노드 밑에 추가하라고 넘겨줌
    );

    // 복제된 순서를 DB에 바로 저장
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