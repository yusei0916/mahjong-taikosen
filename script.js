// ============================================================
// 麻雀ポイント計算 & 大会ランキング
// Googleスプレッドシート横型対応版
// ============================================================


// ============================================================
// Googleスプレッドシート設定
// ============================================================

// HTML側で設定したSHEET_URLを取得
const SHEET_URL = window.SHEET_URL;


// ============================================================
// CSVを1行ずつ正しく読み込む
// ============================================================

function parseCSVLine(line) {

    const result = [];

    let current = "";

    let inQuotes = false;


    for (let i = 0; i < line.length; i++) {

        const char = line[i];


        // ダブルクォーテーション
        if (char === '"') {

            // "" の場合
            if (inQuotes && line[i + 1] === '"') {

                current += '"';

                i++;

            } else {

                inQuotes = !inQuotes;

            }


        // カンマ
        } else if (char === "," && !inQuotes) {

            result.push(current.trim());

            current = "";


        } else {

            current += char;

        }

    }


    result.push(current.trim());


    return result;
}


// ============================================================
// GoogleスプレッドシートのCSVを解析
//
// 横型:
//
// チーム | 名前 | 1試合目 | 2試合目 | 3試合目 | 4試合目
//
// を、内部的には
//
// 試合 | チーム | 名前 | ポイント
//
// の形に変換する
// ============================================================

function parseCSV(csv) {


    const lines = csv

        .replace(/\r\n/g, "\n")

        .replace(/\r/g, "\n")

        .split("\n")

        .filter(line => line.trim() !== "");


    if (lines.length < 1) {

        return [];

    }


    // 1行目：見出し
    const headers = parseCSVLine(lines[0])

        .map(
            header =>
                header.trim().replace(/^\uFEFF/, "")
        );


    // チーム列
    const teamIndex = headers.findIndex(

        header =>
            header === "チーム"

    );


    // 名前列
    const nameIndex = headers.findIndex(

        header =>
            header === "名前"

    );


    if (teamIndex === -1 || nameIndex === -1) {

        throw new Error(

            "「チーム」または「名前」の列が見つかりません。"

        );

    }


    // 1試合目、2試合目……を探す
    const matchColumns = [];


    headers.forEach((header, index) => {


        const match =
            header.match(/^(\d+)試合目$/);


        if (match) {

            matchColumns.push({

                index: index,

                match: Number(match[1])

            });

        }

    });


    if (matchColumns.length === 0) {

        throw new Error(

            "「1試合目」「2試合目」などの列が見つかりません。"

        );

    }


    // 試合番号順
    matchColumns.sort(

        (a, b) =>
            a.match - b.match

    );


    const data = [];


    // 2行目以降
    for (let i = 1; i < lines.length; i++) {


        const values =
            parseCSVLine(lines[i]);


        const team =

            (values[teamIndex] || "").trim();


        const name =

            (values[nameIndex] || "").trim();


        // チーム・名前がなければ無視
        if (!team || !name) {

            continue;

        }


        // この人に試合結果があるか
        let hasMatchResult = false;


        // ----------------------------------------
        // 各試合を確認
        // ----------------------------------------

        matchColumns.forEach(matchColumn => {


            const value =

                (values[matchColumn.index] || "").trim();


            // 空欄ならスキップ
            if (value === "") {

                return;

            }


            const point =

                Number(

                    value

                        .replace(/,/g, "")

                        .replace(/＋/g, "+")

                        .replace(/－/g, "-")

                );


            // 数字じゃなければスキップ
            if (!Number.isFinite(point)) {

                return;

            }


            hasMatchResult = true;


            data.push({

                match:
                    matchColumn.match,

                team:
                    team,

                name:
                    name,

                point:
                    point

            });

        });


        // ----------------------------------------
        // まだ試合結果がない人
        //
        // ランキングには表示したいので、
        // 仮の0ポイントデータを入れる。
        //
        // matchはnullにして、
        // 「第0試合」として表示されないようにする。
        // ----------------------------------------

        if (!hasMatchResult) {

            data.push({

                match: null,

                team: team,

                name: name,

                point: 0

            });

        }

    }


    return data;
}


// ============================================================
// ポイント表示
// ============================================================

function formatPoint(point) {

    const number = Number(point);


    if (!Number.isFinite(number)) {

        return "0.0";

    }


    if (number > 0) {

        return "+" + number.toFixed(1);

    }


    return number.toFixed(1);
}


// ============================================================
// ポイントによってCSSクラスを変更
// ============================================================

function pointClass(point) {

    if (point > 0) {

        return "positive";

    }


    if (point < 0) {

        return "negative";

    }


    return "zero";
}


// ============================================================
// HTMLエスケープ
// ============================================================

function escapeHTML(value) {

    return String(value)

        .replace(/&/g, "&amp;")

        .replace(/</g, "&lt;")

        .replace(/>/g, "&gt;")

        .replace(/"/g, "&quot;")

        .replace(/'/g, "&#039;");

}


// ============================================================
// 順位表示
// ============================================================

function createRankNumber(rank) {

    if (rank === 1) {

        return "🥇";

    }


    if (rank === 2) {

        return "🥈";

    }


    if (rank === 3) {

        return "🥉";

    }


    return rank;
}


// ============================================================
// ランキング計算
// ============================================================

function calculateRankings(data) {


    // --------------------------------------------------------
    // プレイヤー集計
    // --------------------------------------------------------

    const players = new Map();


    // --------------------------------------------------------
    // チーム集計
    // --------------------------------------------------------

    const teams = new Map();


    // ========================================================
    // データを1行ずつ集計
    // ========================================================

    data.forEach((row, index) => {


        // ----------------------------------------------------
        // プレイヤー
        // ----------------------------------------------------

        if (!players.has(row.name)) {

            players.set(row.name, {

                name:
                    row.name,

                team:
                    row.team,

                total:
                    0,

                games:
                    0,

                order:
                    index

            });

        }


        const player =
            players.get(row.name);


        player.total += row.point;


        // nullは仮データなので試合数に含めない
        if (row.match !== null) {

            player.games += 1;

        }


        // ----------------------------------------------------
        // チーム
        // ----------------------------------------------------

        if (!teams.has(row.team)) {

            teams.set(row.team, {

                team:
                    row.team,

                total:
                    0,

                matches:
                    new Set(),

                order:
                    index

            });

        }


        const team =
            teams.get(row.team);


        team.total += row.point;


        // nullは仮データなので試合数に含めない
        if (row.match !== null) {

            team.matches.add(row.match);

        }

    });


    // ========================================================
    // プレイヤーランキング
    // ========================================================

    const playerList =
        [...players.values()];


    playerList.forEach(player => {

        if (player.games > 0) {

            player.average =
                player.total / player.games;

        } else {

            player.average = 0;

        }

    });


    // --------------------------------------------------------
    // 合計ポイントの高い順
    //
    // 同点の場合は「あいうえお順」にしない。
    // スプレッドシートで先に登場した順番を維持。
    // --------------------------------------------------------

    playerList.sort((a, b) => {

        if (b.total !== a.total) {

            return b.total - a.total;

        }


        return a.order - b.order;

    });


    // ========================================================
    // 順位を付ける
    // ========================================================

    let currentRank = 1;


    playerList.forEach((player, index) => {

        if (index > 0) {

            if (
                player.total !==
                playerList[index - 1].total
            ) {

                currentRank = index + 1;

            }

        }


        player.rank = currentRank;

    });


    // ========================================================
    // チームランキング
    // ========================================================

    const teamList =
        [...teams.values()];


    teamList.forEach(team => {

        team.games =
            team.matches.size;


        if (team.games > 0) {

            team.average =
                team.total / team.games;

        } else {

            team.average = 0;

        }

    });


    // --------------------------------------------------------
    // 合計ポイント順
    // 同点の場合はシートに登場した順
    // --------------------------------------------------------

    teamList.sort((a, b) => {

        if (b.total !== a.total) {

            return b.total - a.total;

        }


        return a.order - b.order;

    });


    // ========================================================
    // チーム順位
    // ========================================================

    let teamRank = 1;


    teamList.forEach((team, index) => {

        if (index > 0) {

            if (
                team.total !==
                teamList[index - 1].total
            ) {

                teamRank = index + 1;

            }

        }


        team.rank = teamRank;

    });


    return {

        players:
            playerList,

        teams:
            teamList

    };

}


// ============================================================
// 個人ランキング表示
// ============================================================

function renderPlayerRanking(players) {


    const container =
        document.getElementById(
            "playerRanking"
        );


    if (!container) {

        return;

    }


    if (players.length === 0) {

        container.innerHTML =
            "<p>データがありません。</p>";

        return;

    }


    // ========================================================
    // 個人ランキング
    // 本物のHTML tableとして表示
    // ========================================================

    let html = `

        <div class="ranking-table-wrapper">

            <table class="ranking-table player-ranking-table">

                <thead>

                    <tr>

                        <th>順位</th>

                        <th>名前</th>

                        <th>チーム</th>

                        <th>合計</th>

                        <th>試合</th>

                        <th>平均</th>

                    </tr>

                </thead>

                <tbody>

    `;


    players.forEach(player => {


        html += `

                    <tr>

                        <td class="rank-cell">

                            ${createRankNumber(player.rank)}

                        </td>


                        <td class="name-cell">

                            ${escapeHTML(player.name)}

                        </td>


                        <td class="team-cell">

                            ${escapeHTML(player.team)}

                        </td>


                        <td class="point-cell ${pointClass(player.total)}">

                            ${formatPoint(player.total)}

                        </td>


                        <td class="games-cell">

                            ${player.games}

                        </td>


                        <td class="average-cell ${pointClass(player.average)}">

                            ${formatPoint(player.average)}

                        </td>

                    </tr>

        `;

    });


    html += `

                </tbody>

            </table>

        </div>

    `;


    container.innerHTML =
        html;

}


// ============================================================
// チームランキング表示
// ============================================================

function renderTeamRanking(teams) {


    const container =
        document.getElementById(
            "teamRanking"
        );


    if (!container) {

        return;

    }


    if (teams.length === 0) {

        container.innerHTML =
            "<p>データがありません。</p>";

        return;

    }


    // ========================================================
    // チームランキング
    // 本物のHTML tableとして表示
    // ========================================================

    let html = `

        <div class="ranking-table-wrapper">

            <table class="ranking-table team-ranking-table">

                <thead>

                    <tr>

                        <th>順位</th>

                        <th>チーム</th>

                        <th>合計</th>

                        <th>試合</th>

                        <th>平均</th>

                    </tr>

                </thead>

                <tbody>

    `;


    teams.forEach(team => {


        html += `

                    <tr>

                        <td class="rank-cell">

                            ${createRankNumber(team.rank)}

                        </td>


                        <td class="team-name-cell">

                            ${escapeHTML(team.team)}

                        </td>


                        <td class="point-cell ${pointClass(team.total)}">

                            ${formatPoint(team.total)}

                        </td>


                        <td class="games-cell">

                            ${team.games}

                        </td>


                        <td class="average-cell ${pointClass(team.average)}">

                            ${formatPoint(team.average)}

                        </td>

                    </tr>

        `;

    });


    html += `

                </tbody>

            </table>

        </div>

    `;


    container.innerHTML =
        html;

}


// ============================================================
// 試合結果表示
// ============================================================

function renderMatchResults(data) {


    const container =
        document.getElementById(
            "matchResults"
        );


    if (!container) {

        return;

    }


    // まだ試合結果がない参加者用の
    // 仮データ（match:null）を除外

    const actualData =
        data.filter(
            row => row.match !== null
        );


    if (actualData.length === 0) {

        container.innerHTML =
            "<p>まだ試合結果がありません。</p>";

        return;

    }


    // --------------------------------------------------------
    // 試合番号ごとにグループ化
    // --------------------------------------------------------

    const matches =
        new Map();


    actualData.forEach(row => {


        if (!matches.has(row.match)) {

            matches.set(
                row.match,
                []
            );

        }


        matches
            .get(row.match)
            .push(row);

    });


    // --------------------------------------------------------
    // 試合番号順
    // --------------------------------------------------------

    const sortedMatches =

        [...matches.entries()]

            .sort(
                (a, b) =>
                    a[0] - b[0]
            );


    let html = "";


    sortedMatches.forEach(
        ([matchNumber, rows]) => {


            // ------------------------------------------------
            // その試合のポイント順
            // ------------------------------------------------

            rows.sort((a, b) => {

                return b.point - a.point;

            });


            html += `

                <div class="match-result">

                    <h3>

                        第${matchNumber}試合

                    </h3>


                    <div class="match-table">

            `;


            rows.forEach((row, index) => {


                html += `

                        <div class="match-row">

                            <div class="match-rank">

                                ${index + 1}

                            </div>


                            <div class="match-player">

                                <strong>

                                    ${escapeHTML(row.name)}

                                </strong>


                                <small>

                                    ${escapeHTML(row.team)}

                                </small>

                            </div>


                            <div class="match-point ${pointClass(row.point)}">

                                ${formatPoint(row.point)}

                            </div>

                        </div>

                `;

            });


            html += `

                    </div>

                </div>

            `;

        }

    );


    container.innerHTML =
        html;

}


// ============================================================
// データ件数表示
// ============================================================

function updateDataCount(data) {


    const element =
        document.getElementById(
            "dataCount"
        );


    if (!element) {

        return;

    }


    // nullの仮データは
    // 「実際の試合」として数えない

    const actualData =

        data.filter(
            row => row.match !== null
        );


    const matchNumbers =

        new Set(
            actualData.map(
                row => row.match
            )
        );


    // --------------------------------------------------------
    // まだ試合結果がない場合
    // --------------------------------------------------------

    if (actualData.length === 0) {


        const participantCount =

            new Set(
                data.map(
                    row => row.name
                )
            ).size;


        element.textContent =

            `参加者${participantCount}人・まだ対局結果はありません`;


        return;

    }


    element.textContent =

        `${matchNumbers.size}試合・${actualData.length}件の対局データ`;

}


// ============================================================
// Googleスプレッドシートから読み込み
// ============================================================

async function loadCompetitionData() {


    const refreshButton =
        document.getElementById(
            "refreshButton"
        );


    const status =
        document.getElementById(
            "status"
        );


    // --------------------------------------------------------
    // URL確認
    // --------------------------------------------------------

    if (!SHEET_URL) {


        if (status) {

            status.textContent =

                "GoogleスプレッドシートのURLが設定されていません。";

        }


        return;

    }


    // --------------------------------------------------------
    // 更新ボタン無効化
    // --------------------------------------------------------

    if (refreshButton) {

        refreshButton.disabled = true;

        refreshButton.textContent =
            "読み込み中...";

    }


    if (status) {

        status.textContent =
            "最新データを読み込んでいます...";

    }


    try {


        // ----------------------------------------------------
        // キャッシュ防止
        // ----------------------------------------------------

        const url =

            SHEET_URL +

            (
                SHEET_URL.includes("?")
                    ? "&"
                    : "?"
            ) +

            "t=" +

            Date.now();


        // ----------------------------------------------------
        // CSV取得
        // ----------------------------------------------------

        const response =
            await fetch(url);


        if (!response.ok) {

            throw new Error(

                `HTTPエラー: ${response.status}`

            );

        }


        // ----------------------------------------------------
        // CSV本文
        // ----------------------------------------------------

        const csv =
            await response.text();


        // ----------------------------------------------------
        // CSV解析
        // ----------------------------------------------------

        const data =
            parseCSV(csv);


        if (data.length === 0) {

            throw new Error(

                "参加者データがありません。"

            );

        }


        // ----------------------------------------------------
        // ランキング計算
        // ----------------------------------------------------

        const rankings =
            calculateRankings(data);


        // ----------------------------------------------------
        // 表示
        // ----------------------------------------------------

        renderPlayerRanking(
            rankings.players
        );


        renderTeamRanking(
            rankings.teams
        );


        renderMatchResults(
            data
        );


        updateDataCount(
            data
        );


        // ----------------------------------------------------
        // ステータス
        // ----------------------------------------------------

        if (status) {

            status.textContent =
                "最新データを読み込みました！";

        }


        const lastUpdated =
            document.getElementById(
                "lastUpdated"
            );


        if (lastUpdated) {

            const now =
                new Date();


            lastUpdated.textContent =

                "最終更新：" +

                now.toLocaleString(
                    "ja-JP"
                );

        }


    } catch (error) {


        console.error(

            "データ読み込みエラー:",

            error

        );


        if (status) {

            status.textContent =

                "データを読み込めませんでした。";

        }


        const errorMessage =

            document.getElementById(
                "errorMessage"
            );


        if (errorMessage) {

            errorMessage.textContent =
                error.message;


            errorMessage.style.display =
                "block";

        }


    } finally {


        // ----------------------------------------------------
        // 更新ボタンを元に戻す
        // ----------------------------------------------------

        if (refreshButton) {

            refreshButton.disabled = false;


            refreshButton.textContent =
                "🔄 更新";

        }

    }

}


// ============================================================
// 更新ボタン
// ============================================================

const refreshButton =

    document.getElementById(
        "refreshButton"
    );


if (refreshButton) {

    refreshButton.addEventListener(

        "click",

        loadCompetitionData

    );

}


// ============================================================
// ページを開いたときに自動読み込み
// ============================================================

document.addEventListener(

    "DOMContentLoaded",

    () => {

        loadCompetitionData();

    }

);


// ============================================================
// ここから麻雀点数計算機
// ============================================================


// ------------------------------------------------------------
// HTML要素
// ------------------------------------------------------------

const calculateButton =

    document.getElementById(
        "calculateButton"
    );


const resetButton =

    document.getElementById(
        "resetButton"
    );


const resultElement =

    document.getElementById(
        "result"
    );


const chomboButton =

    document.getElementById(
        "chomboButton"
    );


const chomboStatus =

    document.getElementById(
        "chomboStatus"
    );


// ------------------------------------------------------------
// チョンボ状態
// ------------------------------------------------------------

let isChombo = false;


// ============================================================
// チョンボボタン
// ============================================================

if (chomboButton) {

    chomboButton.addEventListener(

        "click",

        () => {


            isChombo =
                !isChombo;


            if (isChombo) {


                chomboButton.textContent =
                    "チョンボ解除";


                chomboButton.classList.add(
                    "active"
                );


                if (chomboStatus) {

                    chomboStatus.textContent =
                        "チョンボ：90,000点";

                }


            } else {


                chomboButton.textContent =
                    "チョンボ";


                chomboButton.classList.remove(
                    "active"
                );


                if (chomboStatus) {

                    chomboStatus.textContent =
                        "通常：100,000点";

                }

            }

        }

    );

}


// ============================================================
// 「千」ボタン
// ============================================================
//
// score1 ～ score4 の横にある
// 「千」ボタンを押したら
//
// 10 → 10,000
// 25 → 25,000
//
// のようにする。
// ============================================================

document.querySelectorAll(

    ".thousand-button"

).forEach(button => {


    button.addEventListener(

        "click",

        () => {


            const targetId =
                button.dataset.target;


            const input =
                document.getElementById(
                    targetId
                );


            if (!input) {

                return;

            }


            const value =
                Number(input.value);


            if (!Number.isFinite(value)) {

                input.value = "";

                return;

            }


            input.value =
                Math.round(
                    value * 1000
                );

        }

    );

});


// ============================================================
// 点数計算
// ============================================================

if (calculateButton) {

    calculateButton.addEventListener(

        "click",

        () => {


            // ------------------------------------------------
            // プレイヤー情報
            // ------------------------------------------------

            const seats = [

                "東",

                "南",

                "西",

                "北"

            ];


            const players = [];


            // ------------------------------------------------
            // 4人分読み込み
            // ------------------------------------------------

            for (let i = 1; i <= 4; i++) {


                const nameInput =

                    document.getElementById(

                        `name${i}`

                    );


                const scoreInput =

                    document.getElementById(

                        `score${i}`

                    );


                if (!nameInput || !scoreInput) {

                    continue;

                }


                const name =
                    nameInput.value.trim();


                const score =
                    Number(scoreInput.value);


                // ------------------------------------------------
                // 名前チェック
                // ------------------------------------------------

                if (!name) {

                    alert(

                        `${seats[i - 1]}家の名前を入力してください。`

                    );


                    return;

                }


                // ------------------------------------------------
                // 点数チェック
                // ------------------------------------------------

                if (!Number.isFinite(score)) {

                    alert(

                        `${seats[i - 1]}家の点数を入力してください。`

                    );


                    return;

                }


                players.push({

                    seat:
                        seats[i - 1],


                    seatOrder:
                        i - 1,


                    name:
                        name,


                    score:
                        score

                });

            }


            // ====================================================
            // 合計点チェック
            // ====================================================

            const totalScore =

                players.reduce(

                    (sum, player) =>

                        sum + player.score,

                    0

                );


            const requiredTotal =

                isChombo

                    ? 90000

                    : 100000;


            if (totalScore !== requiredTotal) {


                alert(

                    `合計点が${requiredTotal.toLocaleString()}点になっていません。\n` +

                    `現在の合計：${totalScore.toLocaleString()}点`

                );


                return;

            }


            // ====================================================
            // 点数順に並べる
            // ====================================================

            players.sort((a, b) => {


                // 点数が高い順
                if (b.score !== a.score) {

                    return b.score - a.score;

                }


                // 同点なら東南西北順
                return a.seatOrder - b.seatOrder;

            });


            // ====================================================
            // 基本点
            // ====================================================

            const baseScore =
                30000;


            // ====================================================
            // ウマ・オカ
            //
            // 1着 +50
            // 2着 +10
            // 3着 -10
            // 4着 -30
            //
            // オカ込み
            // ====================================================

            const umaOka = [

                50,

                10,

                -10,

                -30

            ];


            // ====================================================
            // 基本ポイント計算
            // ====================================================

            players.forEach(

                (player, index) => {


                    player.rank =
                        index + 1;


                    player.basePoint =

                        (
                            player.score -
                            baseScore
                        ) / 1000;

                }

            );


            // ====================================================
            // 同着処理
            // ====================================================
            //
            // 同着した順位のウマを平均する。
            //
            // 例：
            //
            // 2人が1着同点
            //
            // 1着 +50
            // 2着 +10
            //
            // → (+50 + +10) / 2
            // → +30
            //
            // 3人なら
            //
            // +50 +10 -10
            // ----------------
            //       3
            //
            // という計算。
            // ====================================================

            let index = 0;


            while (index < players.length) {


                let end =
                    index + 1;


                while (

                    end < players.length &&

                    players[end].score ===
                    players[index].score

                ) {

                    end++;

                }


                const tieCount =
                    end - index;


                // 同着している場合
                if (tieCount > 1) {


                    let umaTotal = 0;


                    for (

                        let i = index;

                        i < end;

                        i++

                    ) {


                        umaTotal +=
                            umaOka[i];

                    }


                    const averageUma =

                        umaTotal /
                        tieCount;


                    for (

                        let i = index;

                        i < end;

                        i++

                    ) {


                        players[i].uma =
                            averageUma;

                    }


                } else {


                    players[index].uma =
                        umaOka[index];

                }


                index =
                    end;

            }


            // ====================================================
            // 最終ポイント
            // ====================================================

            players.forEach(player => {

                player.point =

                    player.basePoint +

                    player.uma;

            });


            // ====================================================
            // 1桁目の調整
            // ====================================================
            //
            // 小数第1位まで表示。
            // ====================================================

            players.forEach(player => {

                player.point =

                    Math.round(

                        player.point * 10

                    ) / 10;

            });


            // ====================================================
            // 結果表示
            // ====================================================

            let html = `

                <div class="result-table">

                    <div class="result-header">

                        <div>順位</div>

                        <div>席</div>

                        <div>名前</div>

                        <div>持ち点</div>

                        <div>ポイント</div>

                    </div>

            `;


            players.forEach(player => {


                html += `

                    <div class="result-row">

                        <div>

                            ${createRankNumber(
                                player.rank
                            )}

                        </div>


                        <div>

                            ${player.seat}

                        </div>


                        <div>

                            ${escapeHTML(
                                player.name
                            )}

                        </div>


                        <div>

                            ${player.score.toLocaleString()}

                        </div>


                        <div class="${pointClass(
                            player.point
                        )}">

                            ${formatPoint(
                                player.point
                            )}

                        </div>

                    </div>

                `;

            });


            html += `

                </div>

            `;


            // ====================================================
            // ポイント合計
            // ====================================================

            const pointTotal =

                players.reduce(

                    (sum, player) =>

                        sum + player.point,

                    0

                );


            html += `

                <div class="result-summary">

                    <p>

                        合計ポイント：

                        <strong>

                            ${formatPoint(
                                pointTotal
                            )}

                        </strong>

                    </p>


                    ${

                        isChombo

                            ? `

                                <p>

                                    チョンボ適用：

                                    合計90,000点

                                </p>

                              `

                            : ""

                    }

                </div>

            `;


            if (resultElement) {

                resultElement.innerHTML =
                    html;

            }

        }

    );

}


// ============================================================
// リセット
// ============================================================

if (resetButton) {

    resetButton.addEventListener(

        "click",

        () => {


            // ------------------------------------------------
            // 名前・点数をクリア
            // ------------------------------------------------

            for (let i = 1; i <= 4; i++) {


                const nameInput =

                    document.getElementById(

                        `name${i}`

                    );


                const scoreInput =

                    document.getElementById(

                        `score${i}`

                    );


                if (nameInput) {

                    nameInput.value = "";

                }


                if (scoreInput) {

                    scoreInput.value = "";

                }

            }


            // ------------------------------------------------
            // 結果をクリア
            // ------------------------------------------------

            if (resultElement) {

                resultElement.innerHTML = "";

            }


            // ------------------------------------------------
            // チョンボを解除
            // ------------------------------------------------

            isChombo = false;


            if (chomboButton) {

                chomboButton.textContent =
                    "チョンボ";


                chomboButton.classList.remove(
                    "active"
                );

            }


            if (chomboStatus) {

                chomboStatus.textContent =
                    "通常：100,000点";

            }

        }

    );

}
