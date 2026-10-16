/**
 * 示例课表数据（虚构，仅用于演示）
 * ⚠️ 由 tools/gen-sample-data.mjs 生成，请勿手工编辑。
 */
(function (global) {
  'use strict';
  global.SAMPLE_TIMETABLE = {
  "meta": {
    "term": "2025—2026学年 第一学期",
    "startDate": "2025-09-01",
    "totalWeeks": 18,
    "sectionsPerDay": 12,
    "source": "示例数据（虚构课程，请替换为你的真实课表）",
    "updatedAt": null,
    "sectionTimes": [
      {
        "no": 1,
        "start": "08:00",
        "end": "08:45"
      },
      {
        "no": 2,
        "start": "08:55",
        "end": "09:40"
      },
      {
        "no": 3,
        "start": "10:00",
        "end": "10:45"
      },
      {
        "no": 4,
        "start": "10:55",
        "end": "11:40"
      },
      {
        "no": 5,
        "start": "14:00",
        "end": "14:45"
      },
      {
        "no": 6,
        "start": "14:55",
        "end": "15:40"
      },
      {
        "no": 7,
        "start": "16:00",
        "end": "16:45"
      },
      {
        "no": 8,
        "start": "16:55",
        "end": "17:40"
      },
      {
        "no": 9,
        "start": "19:00",
        "end": "19:45"
      },
      {
        "no": 10,
        "start": "19:55",
        "end": "20:40"
      },
      {
        "no": 11,
        "start": "20:50",
        "end": "21:35"
      },
      {
        "no": 12,
        "start": "21:45",
        "end": "22:30"
      }
    ]
  },
  "courses": [
    {
      "id": "sample-1",
      "name": "高等数学（上）",
      "teacher": "次仁老师",
      "location": "纳金校区 教学楼A-201",
      "className": "",
      "credit": "5",
      "note": "",
      "weekday": 1,
      "sections": {
        "start": 1,
        "end": 2
      },
      "weeks": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16
      ],
      "weeksText": "1-16周"
    },
    {
      "id": "sample-2",
      "name": "大学英语（一）",
      "teacher": "卓玛老师",
      "location": "纳金校区 外语楼B-105",
      "className": "",
      "credit": "4",
      "note": "",
      "weekday": 1,
      "sections": {
        "start": 3,
        "end": 4
      },
      "weeks": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16
      ],
      "weeksText": "1-16周"
    },
    {
      "id": "sample-3",
      "name": "计算机基础",
      "teacher": "李老师",
      "location": "新校区 实验楼C-302",
      "className": "",
      "credit": "3",
      "note": "",
      "weekday": 1,
      "sections": {
        "start": 5,
        "end": 6
      },
      "weeks": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12
      ],
      "weeksText": "1-12周"
    },
    {
      "id": "sample-4",
      "name": "思想道德与法治",
      "teacher": "王老师",
      "location": "纳金校区 教学楼A-108",
      "className": "",
      "credit": "3",
      "note": "",
      "weekday": 2,
      "sections": {
        "start": 1,
        "end": 2
      },
      "weeks": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16
      ],
      "weeksText": "1-16周"
    },
    {
      "id": "sample-5",
      "name": "藏语文基础",
      "teacher": "扎西老师",
      "location": "纳金校区 文科楼D-210",
      "className": "",
      "credit": "3",
      "note": "",
      "weekday": 2,
      "sections": {
        "start": 3,
        "end": 4
      },
      "weeks": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16
      ],
      "weeksText": "1-16周"
    },
    {
      "id": "sample-6",
      "name": "体育（一）",
      "teacher": "张老师",
      "location": "纳金校区 田径场",
      "className": "",
      "credit": "1",
      "note": "",
      "weekday": 2,
      "sections": {
        "start": 5,
        "end": 6
      },
      "weeks": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16
      ],
      "weeksText": "1-16周"
    },
    {
      "id": "sample-7",
      "name": "大学物理",
      "teacher": "刘老师",
      "location": "新校区 实验楼C-201",
      "className": "",
      "credit": "4",
      "note": "",
      "weekday": 3,
      "sections": {
        "start": 1,
        "end": 2
      },
      "weeks": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16
      ],
      "weeksText": "1-16周"
    },
    {
      "id": "sample-8",
      "name": "程序设计基础",
      "teacher": "陈老师",
      "location": "新校区 实验楼C-405",
      "className": "",
      "credit": "4",
      "note": "",
      "weekday": 3,
      "sections": {
        "start": 3,
        "end": 4
      },
      "weeks": [
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16
      ],
      "weeksText": "3-16周"
    },
    {
      "id": "sample-9",
      "name": "形势与政策",
      "teacher": "赵老师",
      "location": "纳金校区 教学楼A-301",
      "className": "",
      "credit": "1",
      "note": "",
      "weekday": 3,
      "sections": {
        "start": 9,
        "end": 10
      },
      "weeks": [
        5,
        7,
        9,
        11
      ],
      "weeksText": "5-11周"
    },
    {
      "id": "sample-10",
      "name": "线性代数",
      "teacher": "周老师",
      "location": "纳金校区 教学楼A-202",
      "className": "",
      "credit": "3",
      "note": "",
      "weekday": 4,
      "sections": {
        "start": 1,
        "end": 2
      },
      "weeks": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16
      ],
      "weeksText": "1-16周"
    },
    {
      "id": "sample-11",
      "name": "大学英语（一）",
      "teacher": "卓玛老师",
      "location": "纳金校区 外语楼B-105",
      "className": "",
      "credit": "4",
      "note": "",
      "weekday": 4,
      "sections": {
        "start": 5,
        "end": 6
      },
      "weeks": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16
      ],
      "weeksText": "1-16周"
    },
    {
      "id": "sample-12",
      "name": "物理实验",
      "teacher": "孙老师",
      "location": "新校区 实验楼C-108",
      "className": "",
      "credit": "1",
      "note": "",
      "weekday": 4,
      "sections": {
        "start": 7,
        "end": 8
      },
      "weeks": [
        6,
        8,
        10,
        12,
        14,
        16
      ],
      "weeksText": "6-16周"
    },
    {
      "id": "sample-13",
      "name": "高等数学（上）",
      "teacher": "次仁老师",
      "location": "纳金校区 教学楼A-201",
      "className": "",
      "credit": "5",
      "note": "",
      "weekday": 5,
      "sections": {
        "start": 1,
        "end": 2
      },
      "weeks": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16
      ],
      "weeksText": "1-16周"
    },
    {
      "id": "sample-14",
      "name": "民族理论与政策",
      "teacher": "马老师",
      "location": "纳金校区 文科楼D-105",
      "className": "",
      "credit": "2",
      "note": "",
      "weekday": 5,
      "sections": {
        "start": 3,
        "end": 4
      },
      "weeks": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12
      ],
      "weeksText": "1-12周"
    },
    {
      "id": "sample-15",
      "name": "专业导论",
      "teacher": "吴老师",
      "location": "新校区 实验楼C-501",
      "className": "",
      "credit": "1",
      "note": "",
      "weekday": 5,
      "sections": {
        "start": 5,
        "end": 6
      },
      "weeks": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8
      ],
      "weeksText": "1-8周"
    }
  ]
};
})(typeof window !== 'undefined' ? window : globalThis);
