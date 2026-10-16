/**
 * 《国家学生体质健康标准（2014年修订）》大学组 评分数据
 *
 * ⚠️ 本文件由 tools/gen-fitness-data.mjs 生成，请勿手工编辑。
 * 数据来源：国家标准原文表格（单项评分表 + 加分指标表），逐格转录。
 * 数值含义：
 *   - 除 1000米/800米 外的项目，成绩 >= 表中数值 即可拿到该档分数（越大越好）
 *   - 1000米/800米 为用时，成绩 <= 表中数值 才拿到该档分数（越小越好）
 *   - strength 项：男生=引体向上(次)，女生=1分钟仰卧起坐(次)
 *   - null 表示该档位无此项目（引体向上只在偶数档给阈值，中间档按就近向下取）
 */
(function (global) {
  'use strict';

  /** 单项权重（%） */
  var WEIGHTS = {
    bmi: 15,
    vitalCapacity: 15,
    sprint50: 20,
    sitReach: 10,
    standingJump: 10,
    strength: 10,
    endurance: 20
  };

  /** BMI 评分区间（与性别相关） */
  var BMI_RULE = {
    male: [
      { level: '正常', score: 100, min: 17.9, max: 23.9 },
      { level: '低体重', score: 80, min: 0, max: 17.8 },
      { level: '超重', score: 80, min: 24.0, max: 27.9 },
      { level: '肥胖', score: 60, min: 28.0, max: 999 }
    ],
    female: [
      { level: '正常', score: 100, min: 17.2, max: 23.9 },
      { level: '低体重', score: 80, min: 0, max: 17.1 },
      { level: '超重', score: 80, min: 24.0, max: 27.9 },
      { level: '肥胖', score: 60, min: 28.0, max: 999 }
    ]
  };

  /** 大学组单项评分表 */
  var TABLES = {
    male: {
      low: [
            {
                  "score": 100,
                  "vitalCapacity": 5040,
                  "sprint50": 6.7,
                  "sitReach": 24.9,
                  "standingJump": 273,
                  "strength": 19,
                  "endurance": "3'17\""
            },
            {
                  "score": 95,
                  "vitalCapacity": 4920,
                  "sprint50": 6.8,
                  "sitReach": 23.1,
                  "standingJump": 268,
                  "strength": 18,
                  "endurance": "3'22\""
            },
            {
                  "score": 90,
                  "vitalCapacity": 4800,
                  "sprint50": 6.9,
                  "sitReach": 21.3,
                  "standingJump": 263,
                  "strength": 17,
                  "endurance": "3'27\""
            },
            {
                  "score": 85,
                  "vitalCapacity": 4550,
                  "sprint50": 7,
                  "sitReach": 19.5,
                  "standingJump": 256,
                  "strength": 16,
                  "endurance": "3'34\""
            },
            {
                  "score": 80,
                  "vitalCapacity": 4300,
                  "sprint50": 7.1,
                  "sitReach": 17.7,
                  "standingJump": 248,
                  "strength": 15,
                  "endurance": "3'42\""
            },
            {
                  "score": 78,
                  "vitalCapacity": 4180,
                  "sprint50": 7.3,
                  "sitReach": 16.3,
                  "standingJump": 244,
                  "strength": null,
                  "endurance": "3'47\""
            },
            {
                  "score": 76,
                  "vitalCapacity": 4060,
                  "sprint50": 7.5,
                  "sitReach": 14.9,
                  "standingJump": 240,
                  "strength": 14,
                  "endurance": "3'52\""
            },
            {
                  "score": 74,
                  "vitalCapacity": 3940,
                  "sprint50": 7.7,
                  "sitReach": 13.5,
                  "standingJump": 236,
                  "strength": null,
                  "endurance": "3'57\""
            },
            {
                  "score": 72,
                  "vitalCapacity": 3820,
                  "sprint50": 7.9,
                  "sitReach": 12.1,
                  "standingJump": 232,
                  "strength": 13,
                  "endurance": "4'02\""
            },
            {
                  "score": 70,
                  "vitalCapacity": 3700,
                  "sprint50": 8.1,
                  "sitReach": 10.7,
                  "standingJump": 228,
                  "strength": null,
                  "endurance": "4'07\""
            },
            {
                  "score": 68,
                  "vitalCapacity": 3580,
                  "sprint50": 8.3,
                  "sitReach": 9.3,
                  "standingJump": 224,
                  "strength": 12,
                  "endurance": "4'12\""
            },
            {
                  "score": 66,
                  "vitalCapacity": 3460,
                  "sprint50": 8.5,
                  "sitReach": 7.9,
                  "standingJump": 220,
                  "strength": null,
                  "endurance": "4'17\""
            },
            {
                  "score": 64,
                  "vitalCapacity": 3340,
                  "sprint50": 8.7,
                  "sitReach": 6.5,
                  "standingJump": 216,
                  "strength": 11,
                  "endurance": "4'22\""
            },
            {
                  "score": 62,
                  "vitalCapacity": 3220,
                  "sprint50": 8.9,
                  "sitReach": 5.1,
                  "standingJump": 212,
                  "strength": null,
                  "endurance": "4'27\""
            },
            {
                  "score": 60,
                  "vitalCapacity": 3100,
                  "sprint50": 9.1,
                  "sitReach": 3.7,
                  "standingJump": 208,
                  "strength": 10,
                  "endurance": "4'32\""
            },
            {
                  "score": 50,
                  "vitalCapacity": 2940,
                  "sprint50": 9.3,
                  "sitReach": 2.7,
                  "standingJump": 203,
                  "strength": 9,
                  "endurance": "4'52\""
            },
            {
                  "score": 40,
                  "vitalCapacity": 2780,
                  "sprint50": 9.5,
                  "sitReach": 1.7,
                  "standingJump": 198,
                  "strength": 8,
                  "endurance": "5'12\""
            },
            {
                  "score": 30,
                  "vitalCapacity": 2620,
                  "sprint50": 9.7,
                  "sitReach": 0.7,
                  "standingJump": 193,
                  "strength": 7,
                  "endurance": "5'32\""
            },
            {
                  "score": 20,
                  "vitalCapacity": 2460,
                  "sprint50": 9.9,
                  "sitReach": -0.3,
                  "standingJump": 188,
                  "strength": 6,
                  "endurance": "5'52\""
            },
            {
                  "score": 10,
                  "vitalCapacity": 2300,
                  "sprint50": 10.1,
                  "sitReach": -1.3,
                  "standingJump": 183,
                  "strength": 5,
                  "endurance": "6'12\""
            }
      ],
      high: [
            {
                  "score": 100,
                  "vitalCapacity": 5140,
                  "sprint50": 6.6,
                  "sitReach": 25.1,
                  "standingJump": 275,
                  "strength": 20,
                  "endurance": "3'15\""
            },
            {
                  "score": 95,
                  "vitalCapacity": 5020,
                  "sprint50": 6.7,
                  "sitReach": 23.3,
                  "standingJump": 270,
                  "strength": 19,
                  "endurance": "3'20\""
            },
            {
                  "score": 90,
                  "vitalCapacity": 4900,
                  "sprint50": 6.8,
                  "sitReach": 21.5,
                  "standingJump": 265,
                  "strength": 18,
                  "endurance": "3'25\""
            },
            {
                  "score": 85,
                  "vitalCapacity": 4650,
                  "sprint50": 6.9,
                  "sitReach": 19.9,
                  "standingJump": 258,
                  "strength": 17,
                  "endurance": "3'32\""
            },
            {
                  "score": 80,
                  "vitalCapacity": 4400,
                  "sprint50": 7,
                  "sitReach": 18.2,
                  "standingJump": 250,
                  "strength": 16,
                  "endurance": "3'40\""
            },
            {
                  "score": 78,
                  "vitalCapacity": 4280,
                  "sprint50": 7.2,
                  "sitReach": 16.8,
                  "standingJump": 246,
                  "strength": null,
                  "endurance": "3'45\""
            },
            {
                  "score": 76,
                  "vitalCapacity": 4160,
                  "sprint50": 7.4,
                  "sitReach": 15.4,
                  "standingJump": 242,
                  "strength": 15,
                  "endurance": "3'50\""
            },
            {
                  "score": 74,
                  "vitalCapacity": 4040,
                  "sprint50": 7.6,
                  "sitReach": 14,
                  "standingJump": 238,
                  "strength": null,
                  "endurance": "3'55\""
            },
            {
                  "score": 72,
                  "vitalCapacity": 3920,
                  "sprint50": 7.8,
                  "sitReach": 12.6,
                  "standingJump": 234,
                  "strength": 14,
                  "endurance": "4'00\""
            },
            {
                  "score": 70,
                  "vitalCapacity": 3800,
                  "sprint50": 8,
                  "sitReach": 11.2,
                  "standingJump": 230,
                  "strength": null,
                  "endurance": "4'05\""
            },
            {
                  "score": 68,
                  "vitalCapacity": 3680,
                  "sprint50": 8.2,
                  "sitReach": 9.8,
                  "standingJump": 226,
                  "strength": 13,
                  "endurance": "4'10\""
            },
            {
                  "score": 66,
                  "vitalCapacity": 3560,
                  "sprint50": 8.4,
                  "sitReach": 8.4,
                  "standingJump": 222,
                  "strength": null,
                  "endurance": "4'15\""
            },
            {
                  "score": 64,
                  "vitalCapacity": 3440,
                  "sprint50": 8.6,
                  "sitReach": 7,
                  "standingJump": 218,
                  "strength": 12,
                  "endurance": "4'20\""
            },
            {
                  "score": 62,
                  "vitalCapacity": 3320,
                  "sprint50": 8.8,
                  "sitReach": 5.6,
                  "standingJump": 214,
                  "strength": null,
                  "endurance": "4'25\""
            },
            {
                  "score": 60,
                  "vitalCapacity": 3200,
                  "sprint50": 9,
                  "sitReach": 4.2,
                  "standingJump": 210,
                  "strength": 11,
                  "endurance": "4'30\""
            },
            {
                  "score": 50,
                  "vitalCapacity": 3030,
                  "sprint50": 9.2,
                  "sitReach": 3.2,
                  "standingJump": 205,
                  "strength": 10,
                  "endurance": "4'50\""
            },
            {
                  "score": 40,
                  "vitalCapacity": 2860,
                  "sprint50": 9.4,
                  "sitReach": 2.2,
                  "standingJump": 200,
                  "strength": 9,
                  "endurance": "5'10\""
            },
            {
                  "score": 30,
                  "vitalCapacity": 2690,
                  "sprint50": 9.6,
                  "sitReach": 1.2,
                  "standingJump": 195,
                  "strength": 8,
                  "endurance": "5'30\""
            },
            {
                  "score": 20,
                  "vitalCapacity": 2520,
                  "sprint50": 9.8,
                  "sitReach": 0.2,
                  "standingJump": 190,
                  "strength": 7,
                  "endurance": "5'50\""
            },
            {
                  "score": 10,
                  "vitalCapacity": 2350,
                  "sprint50": 10,
                  "sitReach": -0.8,
                  "standingJump": 185,
                  "strength": 6,
                  "endurance": "6'10\""
            }
      ]
    },
    female: {
      low: [
            {
                  "score": 100,
                  "vitalCapacity": 3400,
                  "sprint50": 7.5,
                  "sitReach": 25.8,
                  "standingJump": 207,
                  "strength": 56,
                  "endurance": "3'18\""
            },
            {
                  "score": 95,
                  "vitalCapacity": 3350,
                  "sprint50": 7.6,
                  "sitReach": 24,
                  "standingJump": 201,
                  "strength": 54,
                  "endurance": "3'24\""
            },
            {
                  "score": 90,
                  "vitalCapacity": 3300,
                  "sprint50": 7.7,
                  "sitReach": 22.2,
                  "standingJump": 195,
                  "strength": 52,
                  "endurance": "3'30\""
            },
            {
                  "score": 85,
                  "vitalCapacity": 3150,
                  "sprint50": 8,
                  "sitReach": 20.6,
                  "standingJump": 188,
                  "strength": 49,
                  "endurance": "3'37\""
            },
            {
                  "score": 80,
                  "vitalCapacity": 3000,
                  "sprint50": 8.3,
                  "sitReach": 19,
                  "standingJump": 181,
                  "strength": 46,
                  "endurance": "3'44\""
            },
            {
                  "score": 78,
                  "vitalCapacity": 2900,
                  "sprint50": 8.5,
                  "sitReach": 17.7,
                  "standingJump": 178,
                  "strength": 44,
                  "endurance": "3'49\""
            },
            {
                  "score": 76,
                  "vitalCapacity": 2800,
                  "sprint50": 8.7,
                  "sitReach": 16.4,
                  "standingJump": 175,
                  "strength": 42,
                  "endurance": "3'54\""
            },
            {
                  "score": 74,
                  "vitalCapacity": 2700,
                  "sprint50": 8.9,
                  "sitReach": 15.1,
                  "standingJump": 172,
                  "strength": 40,
                  "endurance": "3'59\""
            },
            {
                  "score": 72,
                  "vitalCapacity": 2600,
                  "sprint50": 9.1,
                  "sitReach": 13.8,
                  "standingJump": 169,
                  "strength": 38,
                  "endurance": "4'04\""
            },
            {
                  "score": 70,
                  "vitalCapacity": 2500,
                  "sprint50": 9.3,
                  "sitReach": 12.5,
                  "standingJump": 166,
                  "strength": 36,
                  "endurance": "4'09\""
            },
            {
                  "score": 68,
                  "vitalCapacity": 2400,
                  "sprint50": 9.5,
                  "sitReach": 11.2,
                  "standingJump": 163,
                  "strength": 34,
                  "endurance": "4'14\""
            },
            {
                  "score": 66,
                  "vitalCapacity": 2300,
                  "sprint50": 9.7,
                  "sitReach": 9.9,
                  "standingJump": 160,
                  "strength": 32,
                  "endurance": "4'19\""
            },
            {
                  "score": 64,
                  "vitalCapacity": 2200,
                  "sprint50": 9.9,
                  "sitReach": 8.6,
                  "standingJump": 157,
                  "strength": 30,
                  "endurance": "4'24\""
            },
            {
                  "score": 62,
                  "vitalCapacity": 2100,
                  "sprint50": 10.1,
                  "sitReach": 7.3,
                  "standingJump": 154,
                  "strength": 28,
                  "endurance": "4'29\""
            },
            {
                  "score": 60,
                  "vitalCapacity": 2000,
                  "sprint50": 10.3,
                  "sitReach": 6,
                  "standingJump": 151,
                  "strength": 26,
                  "endurance": "4'34\""
            },
            {
                  "score": 50,
                  "vitalCapacity": 1960,
                  "sprint50": 10.5,
                  "sitReach": 5.2,
                  "standingJump": 146,
                  "strength": 24,
                  "endurance": "4'44\""
            },
            {
                  "score": 40,
                  "vitalCapacity": 1920,
                  "sprint50": 10.7,
                  "sitReach": 4.4,
                  "standingJump": 141,
                  "strength": 22,
                  "endurance": "4'54\""
            },
            {
                  "score": 30,
                  "vitalCapacity": 1880,
                  "sprint50": 10.9,
                  "sitReach": 3.6,
                  "standingJump": 136,
                  "strength": 20,
                  "endurance": "5'04\""
            },
            {
                  "score": 20,
                  "vitalCapacity": 1840,
                  "sprint50": 11.1,
                  "sitReach": 2.8,
                  "standingJump": 131,
                  "strength": 18,
                  "endurance": "5'14\""
            },
            {
                  "score": 10,
                  "vitalCapacity": 1800,
                  "sprint50": 11.3,
                  "sitReach": 2,
                  "standingJump": 126,
                  "strength": 16,
                  "endurance": "5'24\""
            }
      ],
      high: [
            {
                  "score": 100,
                  "vitalCapacity": 3450,
                  "sprint50": 7.4,
                  "sitReach": 26.3,
                  "standingJump": 208,
                  "strength": 57,
                  "endurance": "3'16\""
            },
            {
                  "score": 95,
                  "vitalCapacity": 3400,
                  "sprint50": 7.5,
                  "sitReach": 24.4,
                  "standingJump": 202,
                  "strength": 55,
                  "endurance": "3'22\""
            },
            {
                  "score": 90,
                  "vitalCapacity": 3350,
                  "sprint50": 7.6,
                  "sitReach": 22.4,
                  "standingJump": 196,
                  "strength": 53,
                  "endurance": "3'28\""
            },
            {
                  "score": 85,
                  "vitalCapacity": 3200,
                  "sprint50": 7.9,
                  "sitReach": 21,
                  "standingJump": 189,
                  "strength": 50,
                  "endurance": "3'35\""
            },
            {
                  "score": 80,
                  "vitalCapacity": 3050,
                  "sprint50": 8.2,
                  "sitReach": 19.5,
                  "standingJump": 182,
                  "strength": 47,
                  "endurance": "3'42\""
            },
            {
                  "score": 78,
                  "vitalCapacity": 2950,
                  "sprint50": 8.4,
                  "sitReach": 18.2,
                  "standingJump": 179,
                  "strength": 45,
                  "endurance": "3'47\""
            },
            {
                  "score": 76,
                  "vitalCapacity": 2850,
                  "sprint50": 8.6,
                  "sitReach": 16.9,
                  "standingJump": 176,
                  "strength": 43,
                  "endurance": "3'52\""
            },
            {
                  "score": 74,
                  "vitalCapacity": 2750,
                  "sprint50": 8.8,
                  "sitReach": 15.6,
                  "standingJump": 173,
                  "strength": 41,
                  "endurance": "3'57\""
            },
            {
                  "score": 72,
                  "vitalCapacity": 2650,
                  "sprint50": 9,
                  "sitReach": 14.3,
                  "standingJump": 170,
                  "strength": 39,
                  "endurance": "4'02\""
            },
            {
                  "score": 70,
                  "vitalCapacity": 2550,
                  "sprint50": 9.2,
                  "sitReach": 13,
                  "standingJump": 167,
                  "strength": 37,
                  "endurance": "4'07\""
            },
            {
                  "score": 68,
                  "vitalCapacity": 2450,
                  "sprint50": 9.4,
                  "sitReach": 11.7,
                  "standingJump": 164,
                  "strength": 35,
                  "endurance": "4'12\""
            },
            {
                  "score": 66,
                  "vitalCapacity": 2350,
                  "sprint50": 9.6,
                  "sitReach": 10.4,
                  "standingJump": 161,
                  "strength": 33,
                  "endurance": "4'17\""
            },
            {
                  "score": 64,
                  "vitalCapacity": 2250,
                  "sprint50": 9.8,
                  "sitReach": 9.1,
                  "standingJump": 158,
                  "strength": 31,
                  "endurance": "4'22\""
            },
            {
                  "score": 62,
                  "vitalCapacity": 2150,
                  "sprint50": 10,
                  "sitReach": 7.8,
                  "standingJump": 155,
                  "strength": 29,
                  "endurance": "4'27\""
            },
            {
                  "score": 60,
                  "vitalCapacity": 2050,
                  "sprint50": 10.2,
                  "sitReach": 6.5,
                  "standingJump": 152,
                  "strength": 27,
                  "endurance": "4'32\""
            },
            {
                  "score": 50,
                  "vitalCapacity": 2010,
                  "sprint50": 10.4,
                  "sitReach": 5.7,
                  "standingJump": 147,
                  "strength": 25,
                  "endurance": "4'42\""
            },
            {
                  "score": 40,
                  "vitalCapacity": 1970,
                  "sprint50": 10.6,
                  "sitReach": 4.9,
                  "standingJump": 142,
                  "strength": 23,
                  "endurance": "4'52\""
            },
            {
                  "score": 30,
                  "vitalCapacity": 1930,
                  "sprint50": 10.8,
                  "sitReach": 4.1,
                  "standingJump": 137,
                  "strength": 21,
                  "endurance": "5'02\""
            },
            {
                  "score": 20,
                  "vitalCapacity": 1890,
                  "sprint50": 11,
                  "sitReach": 3.3,
                  "standingJump": 132,
                  "strength": 19,
                  "endurance": "5'12\""
            },
            {
                  "score": 10,
                  "vitalCapacity": 1850,
                  "sprint50": 11.2,
                  "sitReach": 2.5,
                  "standingJump": 127,
                  "strength": 17,
                  "endurance": "5'22\""
            }
      ]
    }
  };

  /** 加分指标：仅男生引体向上/1000米、女生仰卧起坐/800米 可加分，各自上限 10 分 */
  var BONUS = {
    male: {
      strength: { unit: '次', over: {"1":1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10}, max: 10, tip: '超过 19 次(大一大二)/20 次(大三大四) 后，每多完成对应次数加分' },
      endurance: { unit: '秒', over: {"1":4,"2":8,"3":12,"4":16,"5":20,"6":23,"7":26,"8":29,"9":32,"10":35}, max: 10, tip: '比 100 分标准每快对应秒数加分，最多 10 分' }
    },
    female: {
      strength: { unit: '次', over: {"1":2,"2":4,"3":6,"4":7,"5":8,"6":9,"7":10,"8":11,"9":12,"10":13}, max: 10, tip: '超过 56 次(大一大二)/57 次(大三大四) 后，每多完成对应次数加分' },
      endurance: { unit: '秒', over: {"1":4,"2":8,"3":12,"4":16,"5":20,"6":23,"7":26,"8":29,"9":32,"10":35}, max: 10, tip: '比 100 分标准每快对应秒数加分，最多 10 分' }
    }
  };

  /** 等级划分：总分（含加分，满分 120） */
  var GRADES = [
    { min: 90, label: '优秀', cls: 'grade-excellent' },
    { min: 80, label: '良好', cls: 'grade-good' },
    { min: 60, label: '及格', cls: 'grade-pass' },
    { min: -1, label: '不及格', cls: 'grade-fail' }
  ];

  global.FitnessStandard = {
    WEIGHTS: WEIGHTS,
    BMI_RULE: BMI_RULE,
    TABLES: TABLES,
    BONUS: BONUS,
    GRADES: GRADES,
    /** 单项中文名 */
    ITEM_LABELS: {
      bmi: '体重指数（BMI）',
      vitalCapacity: '肺活量',
      sprint50: '50 米跑',
      sitReach: '坐位体前屈',
      standingJump: '立定跳远',
      strength: '引体向上 / 1分钟仰卧起坐',
      endurance: '1000 米 / 800 米跑'
    },
    /** 各单项单位与录入提示 */
    ITEM_META: {
      vitalCapacity: { unit: '毫升', step: 1, hint: '如 4200' },
      sprint50: { unit: '秒', step: 0.1, hint: '如 7.5' },
      sitReach: { unit: '厘米', step: 0.1, hint: '可为负，如 12.3' },
      standingJump: { unit: '厘米', step: 1, hint: '如 235' },
      strength: { unit: '次', step: 1, hint: '男：引体向上次数；女：1分钟仰卧起坐次数' },
      endurance: { unit: '分:秒', step: 1, hint: '如 4′05″ 或直接填 245（秒）' }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
