/**
 * 分类数据验证脚本
 * 
 * 用途：验证课程分类数据的完整性和一致性
 * 运行：在浏览器控制台中运行此脚本
 */

// 导入API函数
import { getCourseCategories, validateCategoryData } from '@/db/api';

/**
 * 运行完整的数据验证
 */
export async function runCategoryValidation() {
  console.log('🔍 开始验证分类数据...\n');

  try {
    // 1. 获取分类列表
    console.log('📋 步骤1：获取分类列表');
    const categories = await getCourseCategories();
    console.log('✅ 分类列表:', categories);
    console.log(`   总数: ${categories.length}个\n`);

    // 2. 验证数据一致性
    console.log('🔍 步骤2：验证数据一致性');
    const validation = await validateCategoryData();
    
    console.log('   数据有效性:', validation.isValid ? '✅ 有效' : '❌ 无效');
    
    if (validation.missingCategories.length > 0) {
      console.warn('   ⚠️ 缺失定义的分类:', validation.missingCategories);
    } else {
      console.log('   ✅ 所有使用的分类都已定义');
    }
    
    if (validation.unusedCategories.length > 0) {
      console.warn('   ⚠️ 未使用的分类:', validation.unusedCategories);
    } else {
      console.log('   ✅ 所有定义的分类都已使用');
    }
    
    console.log('');

    // 3. 生成验证报告
    console.log('📊 步骤3：生成验证报告');
    const report = {
      timestamp: new Date().toISOString(),
      totalCategories: categories.length,
      isValid: validation.isValid,
      missingCategories: validation.missingCategories,
      unusedCategories: validation.unusedCategories,
      status: validation.isValid && validation.missingCategories.length === 0 ? '✅ 通过' : '❌ 失败'
    };
    
    console.log('   验证报告:', report);
    console.log('');

    // 4. 显示总结
    console.log('🎉 验证完成！');
    console.log('');
    console.log('总结：');
    console.log(`- 分类总数: ${categories.length}个`);
    console.log(`- 数据有效性: ${validation.isValid ? '✅ 有效' : '❌ 无效'}`);
    console.log(`- 缺失定义: ${validation.missingCategories.length}个`);
    console.log(`- 未使用分类: ${validation.unusedCategories.length}个`);
    console.log(`- 验证状态: ${report.status}`);

    return report;
  } catch (error) {
    console.error('❌ 验证失败:', error);
    throw error;
  }
}

/**
 * 显示分类详细信息
 */
export async function showCategoryDetails() {
  console.log('📊 分类详细信息\n');

  try {
    const categories = await getCourseCategories();
    
    console.log('分类列表：');
    categories.forEach((category, index) => {
      console.log(`${index + 1}. ${category}`);
    });
    
    console.log(`\n总计: ${categories.length}个分类`);
  } catch (error) {
    console.error('❌ 获取分类失败:', error);
  }
}

/**
 * 快速验证
 */
export async function quickValidation() {
  try {
    const validation = await validateCategoryData();
    
    if (validation.isValid && validation.missingCategories.length === 0) {
      console.log('✅ 数据验证通过！');
      return true;
    } else {
      console.error('❌ 数据验证失败！');
      if (validation.missingCategories.length > 0) {
        console.error('   缺失定义:', validation.missingCategories);
      }
      return false;
    }
  } catch (error) {
    console.error('❌ 验证异常:', error);
    return false;
  }
}

// 导出所有验证函数
export default {
  runCategoryValidation,
  showCategoryDetails,
  quickValidation
};
