"use server";

import { sendPasswordChangedEmail } from "@/lib/email";
import { compare, hash } from "bcryptjs";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checkServerActionRateLimit } from "@/lib/security/request";

export async function changePasswordAction(form: FormData) {
  const session = await auth();
  if (!session?.user?.id) return {ok:false,error:"Sign in to change your password."};
  const rate = await checkServerActionRateLimit([{key:`change-password:${session.user.id}`,limit:5,intervalMs:60_000}]);
  if (!rate.ok) return {ok:false,error:"Please wait a minute before trying again."};
  const current = form.get("currentPassword");
  const password = form.get("password");
  if (typeof current !== "string" || typeof password !== "string" || password.length < 8 || Buffer.byteLength(password,"utf8") > 72 || Buffer.byteLength(current,"utf8") > 72) return {ok:false,error:"Use a new password of at least 8 characters and no more than 72 bytes."};
  if (password !== form.get("confirmPassword")) return {ok:false,error:"Your new passwords do not match."};
  try {
    const user = await db.user.findUnique({where:{id:session.user.id},select:{passwordHash:true,email:true}});
    if (!user?.passwordHash) return {ok:false,error:"This account uses email or Google sign-in. Use Forgot password to set a password by email."};
    if (!(await compare(current,user.passwordHash))) return {ok:false,error:"Your current password is incorrect."};
    if (current === password) return {ok:false,error:"Choose a different password from your current one."};
    const passwordHash = await hash(password,12);
    const updated = await db.user.updateMany({where:{id:session.user.id,passwordHash:user.passwordHash},data:{passwordHash}});
    if (!updated.count) return {ok:false,error:"Your password changed in another window. Please try again."};
    const delivery = user.email ? await sendPasswordChangedEmail(user.email).catch(() => ({ok:false})) : {ok:false};
    return {ok:true, warning: delivery.ok ? undefined : "Your password changed, but the confirmation email could not be sent."};
  } catch { return {ok:false,error:"Could not change your password. Please try again."}; }
}
