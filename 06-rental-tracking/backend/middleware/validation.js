/**
 * 数据验证中间件
 * 
 * @description 使用Joi验证所有输入数据
 * @module backend/middleware/validation
 */

const Joi = require('joi');
const { EXPENSE_CATEGORY_KEYS } = require('../utils/accountingSheet');

/**
 * 项目创建验证规则
 */
const createProjectSchema = Joi.object({
  name: Joi.string().min(1).max(255).required()
    .messages({
      'string.empty': '项目名称不能为空',
      'string.max': '项目名称不能超过255个字符',
      'any.required': '项目名称是必填项'
    }),
  description: Joi.string().max(1000).allow('').optional()
    .messages({
      'string.max': '项目描述不能超过1000个字符'
    }),
  password: Joi.string().min(6).max(50).allow('').optional()
    .messages({
      'string.min': '项目密码至少6个字符',
      'string.max': '项目密码不能超过50个字符'
    }),
  visible: Joi.boolean().optional(),
  projectKind: Joi.string().valid('rental', 'utility', 'accounting', 'tax').optional(),
  sourceAccountingProjectId: Joi.when('projectKind', {
    is: 'tax',
    then: Joi.string().min(1).max(50).required().messages({
      'any.required': '请选择房源来源账目单',
      'string.empty': '请选择房源来源账目单'
    }),
    otherwise: Joi.string().max(50).allow('').optional()
  })
});

const utilitySheetRowSchema = Joi.object({
  id: Joi.string().required(),
  roomNumber: Joi.string().allow('').max(100).default(''),
  lastMonthElectric: Joi.number().min(0).default(0),
  currentMonthElectric: Joi.number().min(0).default(0),
  lastMonthWater: Joi.number().min(0).default(0),
  currentMonthWater: Joi.number().min(0).default(0)
});

/** Empty or strict YYYY-MM-DD (utility billing period). */
const utilityIsoYmd = Joi.string().max(10).allow('').pattern(/^$|^\d{4}-\d{2}-\d{2}$/);

const utilitySheetUpdateSchema = Joi.object({
  utilitySheet: Joi.object({
    pricePerKwh: Joi.number().min(0).default(0),
    pricePerWaterUnit: Joi.number().min(0).default(0),
    readingMonthText: Joi.string().allow('').max(200).default(''),
    readingDateText: Joi.string().allow('').max(200).default(''),
    readingPeriodStartIso: utilityIsoYmd.default(''),
    readingPeriodEndIso: utilityIsoYmd.default(''),
    rows: Joi.array().items(utilitySheetRowSchema).max(200).default([])
  })
    .custom((value, helpers) => {
      const start = (value.readingPeriodStartIso || '').trim();
      const end = (value.readingPeriodEndIso || '').trim();
      if (start && end && end <= start) {
        return helpers.message('Current reading date must be after the previous reading date.');
      }
      return value;
    })
    .required()
});

const monthKeyString = Joi.string().pattern(/^\d{4}-\d{2}$/);
const accountingExprString = Joi.string().max(500).allow('');
/** 空串或 ISO YYYY-MM-DD（日历合法性由 normalize 再收紧） */
const accountingIsoDate = Joi.string().max(10).allow('').pattern(/^$|^\d{4}-\d{2}-\d{2}$/);

const accountingRentMonthSchema = Joi.object({
  in: accountingExprString.default(''),
  out: accountingExprString.default(''),
  settle: accountingExprString.default(''),
  payRent: accountingIsoDate.default('')
});

const accountingGalleryPhotoSchema = Joi.object({
  id: Joi.string().max(200).required(),
  url: Joi.string().uri().required(),
  name: Joi.string().max(255).allow('').default(''),
  size: Joi.number().max(10 * 1024 * 1024).optional()
    .messages({
      'number.max': '照片大小不能超过10MB'
    }),
  uploadedAt: Joi.string().max(50).allow('').optional(),
  capturedAt: Joi.string().max(50).allow('').optional()
});

const accountingGalleryListingSchema = Joi.object({
  gpsUrl: Joi.string().max(500).allow('').default(''),
  condo: Joi.string().max(100).allow('').default(''),
  building: Joi.string().max(100).allow('').default(''),
  occupancy: Joi.string().valid('', 'rented', 'vacant').default(''),
  rentBaht: Joi.string().max(50).allow('').default(''),
  depositBaht: Joi.string().max(50).allow('').default(''),
  areaSqm: Joi.string().max(50).allow('').default(''),
  layout: Joi.string().valid('', 'studio', '1bedroom').default(''),
  electricFee: Joi.string().max(100).allow('').default(''),
  waterFee: Joi.string().max(100).allow('').default(''),
  tvInch: Joi.string().max(20).allow('').default(''),
  tvType: Joi.string().valid('', 'smart', 'cable').default(''),
  internet: Joi.string().valid('', 'yes', 'no').default(''),
  doorAccess: Joi.string().max(100).allow('').default(''),
  shootDate: Joi.string().max(10).allow('').pattern(/^$|^\d{4}-\d{2}-\d{2}$/).default('')
});

const accountingRentRowSchema = Joi.object({
  id: Joi.string().max(100).required(),
  room: Joi.string().max(200).allow('').default(''),
  declaration: accountingIsoDate.default(''),
  actualRent: accountingIsoDate.default(''),
  agency: accountingExprString.default(''),
  remarks: accountingExprString.default(''),
  price: accountingExprString.default(''),
  deposit: accountingExprString.default(''),
  months: Joi.object().pattern(/^\d{4}-\d{2}$/, accountingRentMonthSchema).default({}),
  photos: Joi.array().items(accountingGalleryPhotoSchema).max(500).default([]),
  galleryShareToken: Joi.string().max(80).allow('').default(''),
  galleryListing: accountingGalleryListingSchema.default({})
});

const accountingExpenseRowSchema = Joi.object({
  categoryKey: Joi.string()
    .valid(...EXPENSE_CATEGORY_KEYS)
    .required(),
  months: Joi.object()
    .pattern(/^\d{4}-\d{2}$/, Joi.object({ out: accountingExprString.default('') }))
    .default({})
});

const accountingSheetUpdateSchema = Joi.object({
  accountingSheet: Joi.object({
    monthKeys: Joi.array().items(monthKeyString).length(2).required(),
    rentRows: Joi.array().items(accountingRentRowSchema).max(200).default([]),
    expenseRows: Joi.array().items(accountingExpenseRowSchema).max(20).default([]),
    monthlySummary: Joi.object()
      .pattern(
        /^\d{4}-\d{2}$/,
        Joi.object({
          balance: Joi.number().optional(),
          income: Joi.number().optional(),
          expense: Joi.number().optional()
        })
      )
      .default({})
  }).required()
});

const taxSheetRowSchema = Joi.object({
  id: Joi.string().max(100).required(),
  room: Joi.string().max(200).allow('').default(''),
  sourceRentRowId: Joi.string().max(100).allow('').default(''),
  roomNo: Joi.string().max(200).allow('').default(''),
  condo: Joi.string().max(200).allow('').default(''),
  owner: Joi.string().max(200).allow('').default(''),
  passport: Joi.string().max(200).allow('').default(''),
  taxNo: Joi.string().max(200).allow('').default(''),
  note: Joi.string().max(500).allow('').default('')
});

const taxSheetUpdateSchema = Joi.object({
  taxSheet: Joi.object({
    sourceAccountingProjectId: Joi.string().max(50).required(),
    sourceAccountingProjectName: Joi.string().max(255).allow('').default(''),
    rows: Joi.array().items(taxSheetRowSchema).max(200).default([])
  }).required()
});

/**
 * 项目更新验证规则
 */
const updateProjectSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional()
    .messages({
      'string.empty': '项目名称不能为空',
      'string.max': '项目名称不能超过255个字符'
    }),
  description: Joi.string().max(1000).allow('').optional()
    .messages({
      'string.max': '项目描述不能超过1000个字符'
    }),
  password: Joi.string().min(6).max(50).allow('').optional()
    .messages({
      'string.min': '项目密码至少6个字符',
      'string.max': '项目密码不能超过50个字符'
    }),
  visible: Joi.boolean().optional()
});

/**
 * 房源验证规则
 */
const propertySchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().min(1).max(100).required()
    .messages({
      'string.empty': '房源编号不能为空',
      'string.max': '房源编号不能超过100个字符'
    }),
  monthlyRent: Joi.number().min(0).required()
    .messages({
      'number.min': '月租金不能为负数',
      'any.required': '月租金是必填项'
    }),
  deposit: Joi.number().min(0).default(0)
    .messages({
      'number.min': '押金不能为负数'
    }),
  status: Joi.string().valid('vacant', 'rented', 'new-contract').optional(),
  tenant: Joi.object({
    name: Joi.string().max(100).allow('').optional(),
    phone: Joi.string().max(20).allow('').optional(),
    startDate: Joi.string().allow('').optional(),
    endDate: Joi.string().allow('').optional()
  }).allow(null).optional(),
  records: Joi.array().items(
    Joi.object({
      date: Joi.string().pattern(/^\d{4}-\d{2}$/).required()
        .messages({
          'string.pattern.base': '日期格式必须为YYYY-MM'
        }),
      income: Joi.number().min(0).default(0)
        .messages({
          'number.min': '收入不能为负数'
        }),
      expenses: Joi.number().min(0).default(0)
        .messages({
          'number.min': '支出不能为负数'
        }),
      note: Joi.string().max(500).allow('').optional()
        .messages({
          'string.max': '备注不能超过500个字符'
        }),
      status: Joi.string().valid('vacant', 'rented', 'new-contract').optional(),
      isPaid: Joi.boolean().optional(),
      photos: Joi.array().max(3).items(
        Joi.object({
          id: Joi.string().required(),
          url: Joi.string().uri().optional(),
          data: Joi.string().optional(),
          name: Joi.string().max(255).optional(),
          size: Joi.number().max(10 * 1024 * 1024).optional()
            .messages({
              'number.max': '照片大小不能超过10MB'
            }),
          uploadedAt: Joi.string().optional()
        })
      ).optional()
        .messages({
          'array.max': '每条记录最多3张照片'
        })
    })
  ).default([])
});

/**
 * 房源分组验证规则
 */
const propertyGroupSchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().min(1).max(100).required()
    .messages({
      'string.empty': '分组名称不能为空',
      'string.max': '分组名称不能超过100个字符'
    }),
  collapsed: Joi.boolean().default(false),
  properties: Joi.array().items(propertySchema).default([])
});

/**
 * 项目数据验证规则
 */
const projectDataSchema = Joi.object({
  project: Joi.object({
    id: Joi.string().required(),
    name: Joi.string().min(1).max(255).required(),
    description: Joi.string().max(1000).allow('').optional(),
    password: Joi.string().allow('').optional(),
    hasPassword: Joi.boolean().optional(),
    visible: Joi.alternatives().try(Joi.boolean(), Joi.number().valid(0, 1)).optional(),  // 允许布尔值或0/1
    properties: Joi.array().items(propertySchema).optional(),
    propertyGroups: Joi.array().items(propertyGroupSchema).optional(),  // 数组格式
    expenses: Joi.array().items(
      Joi.object({
        id: Joi.string().required(),
        name: Joi.string().min(1).max(100).required(),
        description: Joi.string().max(500).allow('').optional(),
        records: Joi.array().items(
          Joi.object({
            date: Joi.string().pattern(/^\d{4}-\d{2}$/).required(),
            income: Joi.number().min(0).default(0),
            expenses: Joi.number().min(0).default(0),
            note: Joi.string().max(500).allow('').optional(),
            isPaid: Joi.boolean().optional(),
            photos: Joi.array().max(3).optional()
          })
        ).default([])
      })
    ).optional(),
    projectExpenses: Joi.array().optional(),  // 兼容旧字段名
    createdAt: Joi.string().optional(),
    updatedAt: Joi.string().optional(),
    version: Joi.number().optional()  // 添加version字段
  }).required(),
  projectPassword: Joi.string().allow('').allow(null).optional()
}).options({ allowUnknown: true });

/**
 * 收支记录验证规则
 */
const recordsSchema = Joi.object({
  properties: Joi.array().items(propertySchema).optional(),
  propertyGroups: Joi.array().items(propertyGroupSchema).optional(),  // 数组格式
  expenses: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      name: Joi.string().min(1).max(100).required(),
      description: Joi.string().max(500).allow('').optional(),
      records: Joi.array().items(
        Joi.object({
          date: Joi.string().pattern(/^\d{4}-\d{2}$/).required(),
          income: Joi.number().min(0).default(0),
          expenses: Joi.number().min(0).default(0),
          note: Joi.string().max(500).allow('').optional(),
          isPaid: Joi.boolean().optional(),
          photos: Joi.array().max(3).optional()
        })
      ).default([])
    })
  ).optional(),
  projectPassword: Joi.string().allow('').allow(null).optional()
}).options({ allowUnknown: true });

/**
 * 验证中间件工厂函数
 * @param {Joi.Schema} schema - Joi验证规则
 * @returns {Function} Express中间件
 */
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // 返回所有错误
      stripUnknown: false, // 不移除未知字段，保留它们
      allowUnknown: true  // 允许未知字段
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      console.error('❌ 数据验证失败:', JSON.stringify(errors, null, 2));
      console.error('📦 请求数据:', JSON.stringify(req.body, null, 2));

      return res.status(400).json({
        success: false,
        error: '数据验证失败',
        details: errors
      });
    }

    // 将验证后的数据替换原始数据
    req.body = value;
    next();
  };
}

module.exports = {
  validate,
  createProjectSchema,
  updateProjectSchema,
  projectDataSchema,
  recordsSchema,
  utilitySheetUpdateSchema,
  accountingSheetUpdateSchema,
  taxSheetUpdateSchema
};
