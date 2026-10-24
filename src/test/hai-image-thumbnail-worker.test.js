import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../../workers/hai-image-thumbnail/index.js";
const owner="11111111-1111-4111-8111-111111111111";
const key=`hai-image-generation/${owner}/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.png`;
const host="course-videos.5c8dbf559a0ee7691719bbdfae232038.r2.cloudflarestorage.com";
const accessUrl=`https://${host}/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=120&X-Amz-Signature=test`;
let env,fetchMock,transform,output;
function request(body={key,accessUrl}){return new Request("https://thumbnail.example/thumbnail",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});}
beforeEach(()=>{
 fetchMock=vi.fn().mockResolvedValue(new Response(null,{status:200}));vi.stubGlobal("fetch",fetchMock);
 output=vi.fn().mockResolvedValue({response:()=>new Response("small webp",{headers:{"content-type":"image/webp"}})});
 transform=vi.fn(()=>({output}));env={IMAGE_BUCKET:{head:vi.fn().mockResolvedValue(null),get:vi.fn().mockResolvedValue({size:1000,body:new Response("original").body}),put:vi.fn().mockResolvedValue(undefined)},IMAGES:{input:vi.fn(()=>({transform}))}};
});
afterEach(()=>vi.unstubAllGlobals());
describe("独立缩略图 Worker",()=>{
 it("公开健康检查不返回图片或敏感配置",async()=>{const r=await worker.fetch(new Request("https://thumbnail.example/"),env);expect(await r.json()).toEqual({service:"hai-image-thumbnail",version:3});expect(fetchMock).not.toHaveBeenCalled();});
 it("没有单图授权不能读取或转换图片",async()=>{expect((await worker.fetch(request({key}),env)).status).toBe(401);expect(env.IMAGE_BUCKET.get).not.toHaveBeenCalled();});
 it("拒绝授权校验的重定向，不能跳转到其他地址",async()=>{fetchMock.mockResolvedValueOnce(new Response(null,{status:302,headers:{location:"https://evil.example/"}}));expect((await worker.fetch(request(),env)).status).toBe(401);expect(env.IMAGE_BUCKET.head).not.toHaveBeenCalled();expect(fetchMock).toHaveBeenCalledOnce();});
 it("由R2验证签名，过期或伪造授权不能读取图片",async()=>{fetchMock.mockResolvedValueOnce(new Response(null,{status:403}));expect((await worker.fetch(request(),env)).status).toBe(401);expect(env.IMAGE_BUCKET.head).not.toHaveBeenCalled();expect(fetchMock).toHaveBeenCalledWith(accessUrl,{method:"HEAD",redirect:"manual",signal:expect.anything()});});
 it.each([
 {key:key.replace(owner,"44444444-4444-4444-8444-444444444444"),accessUrl},
 {key:key.replace("33333333-3333-4333-8333-333333333333.png","../secret.png"),accessUrl},
 {key:key+".preview-640.webp",accessUrl},
 {key,accessUrl:accessUrl.replace(host,"evil.example")},
 {key,accessUrl:accessUrl.replace("X-Amz-Expires=120","X-Amz-Expires=3600")},
 ])("拒绝其他对象或来源，不允许路径越界：%s",async(body)=>{expect([403,404]).toContain((await worker.fetch(request(body),env)).status);expect(fetchMock).not.toHaveBeenCalled();expect(env.IMAGE_BUCKET.head).not.toHaveBeenCalled();});
 it("固定生成640像素内WebP，接口不返回原图",async()=>{const r=await worker.fetch(request(),env);expect(r.status).toBe(204);expect(transform).toHaveBeenCalledWith({width:640,height:640,fit:"scale-down"});expect(output).toHaveBeenCalledWith({format:"image/webp",quality:75,anim:false});expect(env.IMAGE_BUCKET.put).toHaveBeenCalledWith(key+".preview-640.webp",expect.any(ArrayBuffer),{httpMetadata:{contentType:"image/webp",cacheControl:"private, max-age=600"}});});
 it("复用已有缩略图之前仍先验证授权",async()=>{env.IMAGE_BUCKET.head.mockResolvedValueOnce({key:key+".preview-640.webp"});expect((await worker.fetch(request(),env)).status).toBe(204);expect(fetchMock).toHaveBeenCalledOnce();expect(env.IMAGES.input).not.toHaveBeenCalled();});
 it("转换失败不保存残缺文件、不返回原图",async()=>{output.mockRejectedValueOnce(new Error("Images unavailable"));expect((await worker.fetch(request(),env)).status).toBe(502);expect(env.IMAGE_BUCKET.put).not.toHaveBeenCalled();});
 it("拒绝超过处理上限的原图",async()=>{env.IMAGE_BUCKET.get.mockResolvedValueOnce({size:21*1024*1024,body:new Response("too big").body});expect((await worker.fetch(request(),env)).status).toBe(413);expect(env.IMAGES.input).not.toHaveBeenCalled();});
 it("限制请求正文大小",async()=>{expect((await worker.fetch(request({key,accessUrl,padding:"x".repeat(2100)}),env)).status).toBe(400);expect(env.IMAGE_BUCKET.head).not.toHaveBeenCalled();});
});
