<script setup>
function handleClickGithub() {
  const url = 'https://github.com/uni-helper/create-uni'
  uni.setClipboardData({
    data: url,
    success: () => {
      uni.showToast({
        icon: 'none',
        title: '链接已复制',
      })
    },
  })
}
</script>

<template>
  <view class="footer" @click="handleClickGithub">
    <image class="uni-helper-github__image" src="/static/github.svg" />
  </view>
</template>

<style>
.footer{
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  color: #888;
}
.uni-helper-github__image {
  display: inline-block;
  height: 1em;
  width: 1em;
}
</style>
